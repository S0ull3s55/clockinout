import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Clock, MapPin, Users, TrendingUp, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/useCompany';
import { useRouter } from 'expo-router';

interface DashboardStats {
  todayHours: number;
  weekHours: number;
  monthHours: number;
  isCurrentlyClockedIn: boolean;
  lastClockAction: {
    type: 'in' | 'out';
    time: string;
  } | null;
}

interface RecentActivity {
  id: string;
  type: 'in' | 'out';
  timestamp: string;
  location_name?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { company, locations } = useCompany();
  const [stats, setStats] = useState<DashboardStats>({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    isCurrentlyClockedIn: false,
    lastClockAction: null,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!supabase) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setUserProfile(profile);

      // Load time records for calculations
      const { data: records } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (records) {
        calculateStats(records);
        setRecentActivity(
          records.slice(0, 5).map(record => ({
            id: record.id,
            type: record.type,
            timestamp: record.timestamp,
            location_name: record.location_id 
              ? locations.find(l => l.id === record.location_id)?.name
              : undefined,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const calculateStats = (records: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayRecords = records.filter(r => new Date(r.timestamp) >= today);
    const weekRecords = records.filter(r => new Date(r.timestamp) >= weekStart);
    const monthRecords = records.filter(r => new Date(r.timestamp) >= monthStart);

    const calculateHours = (recordList: any[]) => {
      let totalMinutes = 0;
      let clockedIn = false;
      let lastClockIn: Date | null = null;

      for (const record of recordList.reverse()) {
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
        totalMinutes += (now.getTime() - lastClockIn.getTime()) / (1000 * 60);
      }

      return totalMinutes / 60;
    };

    const lastRecord = records[0];
    
    setStats({
      todayHours: calculateHours([...todayRecords]),
      weekHours: calculateHours([...weekRecords]),
      monthHours: calculateHours([...monthRecords]),
      isCurrentlyClockedIn: lastRecord?.type === 'in',
      lastClockAction: lastRecord ? {
        type: lastRecord.type,
        time: new Date(lastRecord.timestamp).toLocaleTimeString(),
      } : null,
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              {userProfile?.first_name 
                ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
                : userProfile?.email?.split('@')[0] || 'User'
              }
            </Text>
          </View>
          {company?.logo_url && (
            <Image source={{ uri: company.logo_url }} style={styles.companyLogo} />
          )}
        </View>
        
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
      <TouchableOpacity 
        style={[styles.statusCard, stats.isCurrentlyClockedIn && styles.statusCardActive]}
        onPress={() => router.push('/(tabs)/time-clock')}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIndicator, stats.isCurrentlyClockedIn && styles.statusIndicatorActive]}>
            <Clock size={24} color={stats.isCurrentlyClockedIn ? '#34C759' : '#8E8E93'} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusTitle, stats.isCurrentlyClockedIn && styles.statusTitleActive]}>
              {stats.isCurrentlyClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
            </Text>
            {stats.lastClockAction && (
              <Text style={styles.statusSubtitle}>
                Last {stats.lastClockAction.type}: {stats.lastClockAction.time}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.quickActionContainer}>
          <Text style={styles.quickActionText}>
            Tap to {stats.isCurrentlyClockedIn ? 'Clock Out' : 'Clock In'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Calendar size={20} color="#007AFF" />
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <Text style={styles.statValue}>{stats.todayHours.toFixed(1)}h</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <TrendingUp size={20} color="#34C759" />
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <Text style={styles.statValue}>{stats.weekHours.toFixed(1)}h</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Users size={20} color="#FF9500" />
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <Text style={styles.statValue}>{stats.monthHours.toFixed(1)}h</Text>
        </View>
      </View>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={[
                styles.activityIndicator,
                activity.type === 'in' ? styles.clockInIndicator : styles.clockOutIndicator
              ]}>
                <Clock size={16} color="#FFFFFF" />
              </View>
              
              <View style={styles.activityInfo}>
                <Text style={styles.activityType}>
                  Clock {activity.type === 'in' ? 'In' : 'Out'}
                </Text>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTime}>
                    {new Date(activity.timestamp).toLocaleString()}
                  </Text>
                  {activity.location_name && (
                    <View style={styles.activityLocation}>
                      <MapPin size={12} color="#666" />
                      <Text style={styles.activityLocationText}>
                        {activity.location_name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/time-clock')}>
            <Clock size={24} color="#007AFF" />
            <Text style={styles.quickActionLabel}>Time Clock</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/history')}>
            <Calendar size={24} color="#34C759" />
            <Text style={styles.quickActionLabel}>View History</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/settings')}>
            <Users size={24} color="#FF9500" />
            <Text style={styles.quickActionLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  greetingSection: {
    flex: 1,
  },
  greeting: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  userName: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#000',
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
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
  statusSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  quickActionContainer: {
    alignItems: 'center',
  },
  quickActionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#007AFF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
  },
  activitySection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
  },
  seeAllText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#007AFF',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityIndicator: {
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
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  activityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  activityLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityLocationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});