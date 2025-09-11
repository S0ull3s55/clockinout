import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Clock, MapPin, CircleCheck as CheckCircle, CircleAlert as AlertCircle, X, Navigation } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/useCompany';
import * as Location from 'expo-location';

interface TimeRecord {
  id: string;
  type: 'in' | 'out';
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_id: string | null;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function TimeClockScreen() {
  const { company, locations } = useCompany();
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null);
  const [lastRecord, setLastRecord] = useState<TimeRecord | null>(null);
  const [todayRecords, setTodayRecords] = useState<TimeRecord[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    requestLocationPermission();
    fetchTodayRecords();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'web') {
      // For web, we'll use the browser's geolocation API
      if (navigator.geolocation) {
        setLocationPermission(true);
      }
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async (): Promise<UserLocation | null> => {
    if (!locationPermission) {
      Alert.alert('Permission Required', 'Location permission is required to clock in/out');
      return null;
    }

    setGettingLocation(true);
    try {
      if (Platform.OS === 'web') {
        // Guard for static rendering
        if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
          throw new Error('Geolocation not available');
        }
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              });
            },
            (error) => {
              console.error('Web geolocation error:', error);
              reject(error);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        });
      } else {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        };
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Unable to get your current location');
      return null;
    } finally {
      setGettingLocation(false);
    }
  };

  const fetchTodayRecords = async () => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', `${today}T00:00:00.000Z`)
        .lt('timestamp', `${today}T23:59:59.999Z`)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      setTodayRecords(data || []);
      setLastRecord(data?.[0] || null);
    } catch (error: any) {
      console.error('Error fetching records:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findNearestLocation = (userLat: number, userLon: number) => {
    if (!locations.length) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const location of locations) {
      const distance = calculateDistance(userLat, userLon, location.latitude, location.longitude);
      if (distance <= location.radius && distance < minDistance) {
        minDistance = distance;
        nearest = location;
      }
    }

    return nearest;
  };

  const handleClockAction = async (type: 'in' | 'out') => {
    try {
      setLoading(true);

      // Get current location
      const location = await getCurrentLocation();
      if (!location) return;

      setCurrentLocation(location);

      // Check if we need to select a location
      const nearestLocation = findNearestLocation(location.latitude, location.longitude);
      
      if (company?.settings?.requireLocation && !nearestLocation && locations.length > 0) {
        setShowLocationModal(true);
        return;
      }

      await submitTimeRecord(type, location, nearestLocation?.id || selectedLocationId);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitTimeRecord = async (
    type: 'in' | 'out', 
    location: UserLocation, 
    locationId: string | null
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('time_records')
        .insert({
          user_id: user.id,
          type,
          latitude: location.latitude,
          longitude: location.longitude,
          location_id: locationId,
        });

      if (error) throw error;

      Alert.alert(
        'Success',
        `Successfully clocked ${type}!`,
        [{ text: 'OK', onPress: () => fetchTodayRecords() }]
      );

      setShowLocationModal(false);
      setSelectedLocationId(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getNextAction = (): 'in' | 'out' => {
    if (!lastRecord) return 'in';
    return lastRecord.type === 'in' ? 'out' : 'in';
  };

  const calculateTotalHours = (): string => {
    let totalMinutes = 0;
    let clockedIn = false;
    let lastClockIn: Date | null = null;

    for (const record of [...todayRecords].reverse()) {
      if (record.type === 'in') {
        lastClockIn = new Date(record.timestamp);
        clockedIn = true;
      } else if (record.type === 'out' && lastClockIn) {
        const clockOut = new Date(record.timestamp);
        totalMinutes += (clockOut.getTime() - lastClockIn.getTime()) / (1000 * 60);
        clockedIn = false;
        lastClockIn = null;
      }
    }

    // If currently clocked in, add time since last clock in
    if (clockedIn && lastClockIn) {
      totalMinutes += (new Date().getTime() - lastClockIn.getTime()) / (1000 * 60);
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
  };

  const isCurrentlyClockedIn = (): boolean => {
    return lastRecord?.type === 'in';
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const nextAction = getNextAction();
  const clockedIn = isCurrentlyClockedIn();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, clockedIn && styles.statusCardActive]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, clockedIn && styles.statusIndicatorActive]}>
              <Clock size={24} color={clockedIn ? '#34C759' : '#8E8E93'} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, clockedIn && styles.statusTitleActive]}>
                {clockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
              </Text>
              {lastRecord && (
                <Text style={styles.statusTime}>
                  Last {lastRecord.type}: {new Date(lastRecord.timestamp).toLocaleTimeString()}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.hoursContainer}>
            <Text style={styles.hoursLabel}>Today's Hours</Text>
            <Text style={styles.hoursValue}>{calculateTotalHours()}</Text>
          </View>
        </View>

        {/* Clock Action Button */}
        <TouchableOpacity
          style={[
            styles.clockButton,
            nextAction === 'in' ? styles.clockInButton : styles.clockOutButton,
            loading && styles.clockButtonDisabled,
          ]}
          onPress={() => handleClockAction(nextAction)}
          disabled={loading || gettingLocation}>
          {loading || gettingLocation ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <CheckCircle size={32} color="#FFFFFF" />
              <Text style={styles.clockButtonText}>
                Clock {nextAction === 'in' ? 'In' : 'Out'}
              </Text>
              {gettingLocation && (
                <Text style={styles.clockButtonSubtext}>Getting location...</Text>
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Location Info */}
        {currentLocation && (
          <View style={styles.locationCard}>
            <MapPin size={20} color="#007AFF" />
            <Text style={styles.locationText}>
              Current Location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Today's Records */}
        {todayRecords.length > 0 && (
          <View style={styles.recordsSection}>
            <Text style={styles.sectionTitle}>Today's Activity</Text>
            {todayRecords.map((record) => (
              <View key={record.id} style={styles.recordItem}>
                <View style={styles.recordInfo}>
                  <View style={[
                    styles.recordTypeIndicator,
                    record.type === 'in' ? styles.clockInIndicator : styles.clockOutIndicator
                  ]}>
                    <Clock size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.recordDetails}>
                    <Text style={styles.recordType}>
                      Clock {record.type === 'in' ? 'In' : 'Out'}
                    </Text>
                    <Text style={styles.recordTime}>
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
                {record.location_id && (
                  <View style={styles.recordLocation}>
                    <MapPin size={14} color="#666" />
                    <Text style={styles.recordLocationText}>
                      {locations.find(l => l.id === record.location_id)?.name || 'Unknown Location'}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Location Selection Modal */}
      <Modal visible={showLocationModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowLocationModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose your work location for this clock {nextAction}:
            </Text>

            <ScrollView style={styles.locationList}>
              <TouchableOpacity
                style={[
                  styles.locationOption,
                  !selectedLocationId && styles.locationOptionSelected
                ]}
                onPress={() => setSelectedLocationId(null)}>
                <Text style={[
                  styles.locationOptionText,
                  !selectedLocationId && styles.locationOptionTextSelected
                ]}>
                  Remote Work
                </Text>
                {!selectedLocationId && (
                  <CheckCircle size={20} color="#007AFF" />
                )}
              </TouchableOpacity>

              {locations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationOption,
                    selectedLocationId === location.id && styles.locationOptionSelected
                  ]}
                  onPress={() => setSelectedLocationId(location.id)}>
                  <View style={styles.locationOptionInfo}>
                    <Text style={[
                      styles.locationOptionText,
                      selectedLocationId === location.id && styles.locationOptionTextSelected
                    ]}>
                      {location.name}
                    </Text>
                    <Text style={styles.locationOptionAddress}>
                      {location.address}
                    </Text>
                  </View>
                  {selectedLocationId === location.id && (
                    <CheckCircle size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                loading && styles.confirmButtonDisabled
              ]}
              onPress={() => {
                if (currentLocation) {
                  submitTimeRecord(nextAction, currentLocation, selectedLocationId);
                }
              }}
              disabled={loading}>
              <Text style={styles.confirmButtonText}>
                {loading ? 'Processing...' : `Confirm Clock ${nextAction}`}
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
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  welcomeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#000',
    marginBottom: 4,
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusIndicatorActive: {
    backgroundColor: '#E8F5E8',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#000',
    marginBottom: 4,
  },
  statusTitleActive: {
    color: '#34C759',
  },
  statusTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  hoursContainer: {
    alignItems: 'center',
  },
  hoursLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  hoursValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#007AFF',
  },
  clockButton: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  clockInButton: {
    backgroundColor: '#34C759',
  },
  clockOutButton: {
    backgroundColor: '#FF3B30',
  },
  clockButtonDisabled: {
    opacity: 0.7,
  },
  clockButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    marginTop: 8,
  },
  clockButtonSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 4,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  recordsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
    marginBottom: 16,
  },
  recordItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTypeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clockInIndicator: {
    backgroundColor: '#34C759',
  },
  clockOutIndicator: {
    backgroundColor: '#FF3B30',
  },
  recordDetails: {
    flex: 1,
  },
  recordType: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#000',
  },
  recordTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  recordLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 44,
  },
  recordLocationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  locationList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginBottom: 8,
  },
  locationOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  locationOptionInfo: {
    flex: 1,
  },
  locationOptionText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#000',
  },
  locationOptionTextSelected: {
    color: '#007AFF',
  },
  locationOptionAddress: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});