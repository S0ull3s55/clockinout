import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { supabase } from '@/lib/supabase';
import { UserPlus, Trash2, CreditCard as Edit2, CircleCheck as CheckCircle, MapPin, Download, X, Map } from 'lucide-react-native';
import { useCompany } from '@/lib/useCompany';

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  location_id?: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  employee_number: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface NewLocation {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radius: string;
}

export default function AdminScreen() {
  const { company, locations, refreshLocations } = useCompany();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showNewLocationModal, setShowNewLocationModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'staff',
    locationId: null as string | null,
  });
  const [newLocation, setNewLocation] = useState<NewLocation>({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '100',
  });

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const getWebOrigin = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8081';
  };

  const fetchUsers = async () => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        Alert.alert('Error', 'User is not associated with a company');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!validateNewUserForm()) return;

    try {
      setLoading(true);
      
      if (!supabase) {
        Alert.alert('Error', 'Database connection not available');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          phone: newUser.phone,
          role: newUser.role,
          locationId: newUser.locationId,
          companyId: company?.id,
          companyName: company?.name,
          inviteUrl: `${getWebOrigin()}/complete-profile`,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      Alert.alert('Success', 'User created successfully!');
      setShowNewUserModal(false);
      setNewUser({ email: '', firstName: '', lastName: '', phone: '', role: 'staff', locationId: null });
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateNewUserForm = () => {
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    
    if (!newUser.email || !newUser.firstName || !newUser.lastName || !newUser.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    if (!newUser.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (!phoneRegex.test(newUser.phone)) {
      Alert.alert('Error', 'Invalid phone number format');
      return false;
    }
    return true;
  };

  const handleExportTimeRecords = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('Error', 'Export functionality is only available on web');
      return;
    }

    if (!supabase) {
      Alert.alert('Error', 'Database connection not available');
      return;
    }

    try {
      setLoading(true);
      
      let query = supabase
        .from('time_records')
        .select(`
          id,
          type,
          timestamp,
          latitude,
          longitude,
          location_id,
          user_id,
          profiles(email, first_name, last_name)
        `)
        .order('timestamp', { ascending: false });

      if (selectedUsers.length > 0) {
        query = query.in('user_id', selectedUsers);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert('No Records', 'No time records found');
        return;
      }

      const csvContent = [
        'User,Email,Type,Date,Time,Location,Coordinates',
        ...data.map(record => {
          const user = record.profiles as any;
          const userName = user?.first_name && user?.last_name 
            ? `${user.first_name} ${user.last_name}`
            : user?.email || 'Unknown';
          const location = record.location_id 
            ? locations.find(l => l.id === record.location_id)?.name || 'Unknown'
            : 'Remote';
          const coords = record.latitude && record.longitude 
            ? `"${record.latitude}, ${record.longitude}"`
            : '';
          
          return [
            `"${userName}"`,
            user?.email || '',
            record.type.toUpperCase(),
            new Date(record.timestamp).toLocaleDateString(),
            new Date(record.timestamp).toLocaleTimeString(),
            location,
            coords
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time_records_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'Time records exported!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    Alert.alert(
      'Delete User',
      `Delete ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

              if (error) throw error;
              setUsers(users.filter(u => u.id !== user.id));
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleEditUser = (user: User) => {
    Alert.alert(
      'Edit User',
      'Select action:',
      [
        { text: 'Change Role', onPress: () => handleChangeRole(user) },
        { text: 'Assign Location', onPress: () => handleAssignLocation(user) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleChangeRole = (user: User) => {
    Alert.alert(
      'Change Role',
      'Select new role:',
      [
        { text: 'Staff', onPress: () => updateUserRole(user, 'staff') },
        { text: 'Supervisor', onPress: () => updateUserRole(user, 'supervisor') },
        { text: 'Admin', onPress: () => updateUserRole(user, 'admin') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAssignLocation = (user: User) => {
    Alert.alert(
      'Assign Location',
      'Select location:',
      [
        ...locations.map(location => ({
          text: location.name,
          onPress: () => updateUserLocation(user, location.id),
        })),
        { text: 'Remove Location', onPress: () => updateUserLocation(user, null) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const updateUserRole = async (user: User, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);

      if (error) throw error;
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateUserLocation = async (user: User, locationId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ location_id: locationId })
        .eq('id', user.id);

      if (error) throw error;
      setUsers(users.map(u => u.id === user.id ? { ...u, location_id: locationId } : u));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddLocation = async () => {
    if (!validateLocationForm()) return;
  
    try {
      setLoading(true);
      const lat = parseFloat(newLocation.latitude);
      const lng = parseFloat(newLocation.longitude);

      const { error } = await supabase.from('company_locations').insert({
        name: newLocation.name,
        address: newLocation.address,
        latitude: lat,
        longitude: lng,
        radius: parseFloat(newLocation.radius),
        company_id: company?.id,
      });

      if (error) throw error;
      await refreshLocations();
      setShowNewLocationModal(false);
      setNewLocation({ 
        name: '', 
        address: '',
        latitude: '',
        longitude: '',
        radius: '100'
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateLocationForm = () => {
    const requiredFields = ['name', 'address', 'latitude', 'longitude', 'radius'];
    if (requiredFields.some(field => !newLocation[field as keyof NewLocation])) {
      Alert.alert('Error', 'All fields are required');
      return false;
    }

    if (isNaN(parseFloat(newLocation.latitude))) {
      Alert.alert('Error', 'Invalid latitude');
      return false;
    }
    if (isNaN(parseFloat(newLocation.longitude))) {
      Alert.alert('Error', 'Invalid longitude');
      return false;
    }
    if (isNaN(parseFloat(newLocation.radius)) || parseFloat(newLocation.radius) <= 0) {
      Alert.alert('Error', 'Radius must be a positive number');
      return false;
    }

    return true;
  };

  const handleDeleteLocation = async (locationId: string) => {
    Alert.alert(
      'Delete Location',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('company_locations')
                .delete()
                .eq('id', locationId);

              if (error) throw error;
              await refreshLocations();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {company?.logo_url && (
          <Image source={{ uri: company.logo_url }} style={styles.logo} />
        )}
        <Text style={styles.companyName}>{company?.name}</Text>
      </View>

      {/* Locations Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Locations</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowNewLocationModal(true)}>
            <Map size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Location</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal style={styles.locationsContainer}>
          {locations.map(location => (
            <View key={location.id} style={styles.locationCard}>
              <Text style={styles.locationName}>{location.name}</Text>
              <Text style={styles.locationAddress}>{location.address}</Text>
              <Text style={styles.locationCoords}>
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
              <Text style={styles.locationRadius}>Radius: {location.radius}m</Text>
              <TouchableOpacity
                style={styles.deleteLocationButton}
                onPress={() => handleDeleteLocation(location.id)}>
                <Trash2 size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Users Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Users</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowNewUserModal(true)}>
            <UserPlus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add User</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportTimeRecords}>
              <Download size={20} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>
                Export {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.userList}>
          {users.filter(user => 
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(user => (
            <TouchableOpacity
              key={user.id}
              style={[styles.userCard, selectedUsers.includes(user.id) && styles.userCardSelected]}
              onPress={() => toggleUserSelection(user.id)}>
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{user.email}</Text>
                {(user.first_name || user.last_name) && (
                  <Text style={styles.userName}>
                    {`${user.first_name || ''} ${user.last_name || ''}`.trim()}
                  </Text>
                )}
                <View style={styles.userDetails}>
                  <View style={styles.roleContainer}>
                    <CheckCircle size={16} color={
                      user.role === 'admin' ? '#34C759' :
                      user.role === 'supervisor' ? '#007AFF' : '#8E8E93'
                    } />
                    <Text style={[
                      styles.userRole,
                      user.role === 'admin' && styles.adminRole,
                      user.role === 'supervisor' && styles.supervisorRole,
                    ]}>
                      {user.role}
                    </Text>
                  </View>
                  {user.location_id && (
                    <View style={styles.locationContainer}>
                      <MapPin size={16} color="#666" />
                      <Text style={styles.locationText}>
                        {locations.find(l => l.id === user.location_id)?.name || 'Unknown'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => { e.stopPropagation(); handleEditUser(user); }}>
                  <Edit2 size={16} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => { e.stopPropagation(); handleDeleteUser(user); }}>
                  <Trash2 size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* New Location Modal */}
      <Modal visible={showNewLocationModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Location</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowNewLocationModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newLocation.name}
                onChangeText={text => setNewLocation(prev => ({ ...prev, name: text }))}
                placeholder="Office Name"
              />

              <Text style={styles.inputLabel}>Address *</Text>
              <TextInput
                style={styles.modalInput}
                value={newLocation.address}
                onChangeText={text => setNewLocation(prev => ({ ...prev, address: text }))}
                placeholder="Full Address"
              />

              <View style={styles.coordinatesRow}>
                <View style={styles.coordinateInput}>
                  <Text style={styles.inputLabel}>Latitude *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newLocation.latitude}
                    onChangeText={text => setNewLocation(prev => ({ ...prev, latitude: text }))}
                    placeholder="37.7749"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.coordinateInput}>
                  <Text style={styles.inputLabel}>Longitude *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newLocation.longitude}
                    onChangeText={text => setNewLocation(prev => ({ ...prev, longitude: text }))}
                    placeholder="-122.4194"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Radius (meters) *</Text>
              <TextInput
                style={styles.modalInput}
                value={newLocation.radius}
                onChangeText={text => setNewLocation(prev => ({ ...prev, radius: text }))}
                placeholder="100"
                keyboardType="numeric"
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleAddLocation}
              disabled={loading}>
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : 'Add Location'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New User Modal */}
      <Modal visible={showNewUserModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add User</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowNewUserModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.modalInput}
                value={newUser.email}
                onChangeText={text => setNewUser(prev => ({ ...prev, email: text }))}
                placeholder="user@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>First Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newUser.firstName}
                onChangeText={text => setNewUser(prev => ({ ...prev, firstName: text }))}
                placeholder="John"
              />

              <Text style={styles.inputLabel}>Last Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newUser.lastName}
                onChangeText={text => setNewUser(prev => ({ ...prev, lastName: text }))}
                placeholder="Doe"
              />

              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={styles.modalInput}
                value={newUser.phone}
                onChangeText={text => setNewUser(prev => ({ ...prev, phone: text }))}
                placeholder="+1 234 567 8900"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.roleButtons}>
                {['staff', 'supervisor', 'admin'].map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      newUser.role === role && styles.roleButtonActive
                    ]}
                    onPress={() => setNewUser(prev => ({ ...prev, role }))}>
                    <Text style={[
                      styles.roleButtonText,
                      newUser.role === role && styles.roleButtonTextActive
                    ]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Location</Text>
              <View style={styles.locationButtons}>
                <TouchableOpacity
                  style={[
                    styles.locationButton,
                    !newUser.locationId && styles.locationButtonActive
                  ]}
                  onPress={() => setNewUser(prev => ({ ...prev, locationId: null }))}>
                  <Text style={[
                    styles.locationButtonText,
                    !newUser.locationId && styles.locationButtonTextActive
                  ]}>
                    Remote
                  </Text>
                </TouchableOpacity>
                {locations.map(location => (
                  <TouchableOpacity
                    key={location.id}
                    style={[
                      styles.locationButton,
                      newUser.locationId === location.id && styles.locationButtonActive
                    ]}
                    onPress={() => setNewUser(prev => ({ ...prev, locationId: location.id }))}>
                    <Text style={[
                      styles.locationButtonText,
                      newUser.locationId === location.id && styles.locationButtonTextActive
                    ]}>
                      {location.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleCreateUser}
              disabled={loading}>
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : 'Create User'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
  },
  companyName: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    margin: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#000',
  },
  locationsContainer: {
    marginVertical: 10,
  },
  locationCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginRight: 10,
    width: 250,
  },
  locationName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 5,
  },
  locationAddress: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  locationCoords: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#888',
    marginBottom: 3,
  },
  locationRadius: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#888',
  },
  deleteLocationButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Inter-Regular',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  exportButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButtonText: {
    color: '#FFF',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  userList: {
    maxHeight: 400,
  },
  userCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  userCardSelected: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 2,
  },
  userName: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  userDetails: {
    gap: 5,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  adminRole: {
    color: '#34C759',
  },
  supervisorRole: {
    color: '#007AFF',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
  },
  closeButton: {
    padding: 5,
  },
  modalForm: {
    maxHeight: 500,
  },
  inputLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontFamily: 'Inter-Regular',
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordinateInput: {
    flex: 1,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  roleButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#007AFF',
  },
  roleButtonText: {
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  roleButtonTextActive: {
    color: '#FFF',
    fontFamily: 'Inter-Bold',
  },
  locationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  locationButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  locationButtonActive: {
    backgroundColor: '#007AFF',
  },
  locationButtonText: {
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  locationButtonTextActive: {
    color: '#FFF',
    fontFamily: 'Inter-Bold',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
});