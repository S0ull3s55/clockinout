import { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  RefreshControl, 
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Clock, MapPin, Calendar, Filter, Download } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/useCompany';

interface TimeRecord {
  id: string;
  type: 'in' | 'out';
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_id: string | null;
}

interface DayGroup {
  date: string;
  records: TimeRecord[];
  totalHours: number;
}

export default function HistoryScreen() {
  const { locations } = useCompany();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [groupedRecords, setGroupedRecords] = useState<DayGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'week' | 'month' | 'all'>('week');

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      if (!supabase) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      // Apply date filter
      const now = new Date();
      if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('timestamp', weekAgo.toISOString());
      } else if (filter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('timestamp', monthAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      setRecords(data || []);
      groupRecordsByDay(data || []);
    } catch (error: any) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupRecordsByDay = (records: TimeRecord[]) => {
    const groups: { [key: string]: TimeRecord[] } = {};

    records.forEach(record => {
      const date = new Date(record.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });

    const dayGroups: DayGroup[] = Object.entries(groups).map(([date, dayRecords]) => ({
      date,
      records: dayRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      totalHours: calculateDayHours(dayRecords),
    }));

    setGroupedRecords(dayGroups);
  };

  const calculateDayHours = (dayRecords: TimeRecord[]): number => {
    let totalMinutes = 0;
    let clockedIn = false;
    let lastClockIn: Date | null = null;

    for (const record of dayRecords) {
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

    return totalMinutes / 60;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const exportData = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      alert('Export is only available on web');
      return;
    }

    try {
      const csvContent = [
        'Date,Type,Time,Location,Coordinates',
        ...records.map(record => {
          const location = record.location_id 
            ? locations.find(l => l.id === record.location_id)?.name || 'Unknown'
            : 'Remote';
          const coords = record.latitude && record.longitude 
            ? `"${record.latitude}, ${record.longitude}"`
            : '';
          
          return [
            new Date(record.timestamp).toLocaleDateString(),
            record.type.toUpperCase(),
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
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const renderRecord = ({ item }: { item: TimeRecord }) => (
    <View style={styles.recordItem}>
      <View style={styles.recordHeader}>
        <View style={[
          styles.recordTypeIndicator,
          item.type === 'in' ? styles.clockInIndicator : styles.clockOutIndicator
        ]}>
          <Clock size={16} color="#FFFFFF" />
        </View>
        <View style={styles.recordInfo}>
          <Text style={styles.recordType}>
            Clock {item.type === 'in' ? 'In' : 'Out'}
          </Text>
          <Text style={styles.recordTime}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </View>
      
      {(item.location_id || (item.latitude && item.longitude)) && (
        <View style={styles.locationContainer}>
          <MapPin size={14} color="#666" />
          <Text style={styles.locationText}>
            {item.location_id 
              ? locations.find(l => l.id === item.location_id)?.name || 'Unknown Location'
              : item.latitude && item.longitude
                ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                : 'No location data'
            }
          </Text>
        </View>
      )}
    </View>
  );

  const renderDayGroup = ({ item }: { item: DayGroup }) => (
    <View style={styles.dayGroup}>
      <View style={styles.dayHeader}>
        <View style={styles.dayInfo}>
          <Calendar size={20} color="#007AFF" />
          <Text style={styles.dayDate}>
            {new Date(item.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <Text style={styles.dayHours}>
          {item.totalHours.toFixed(1)}h
        </Text>
      </View>
      
      {item.records.map(record => (
        <View key={record.id} style={styles.recordWrapper}>
          {renderRecord({ item: record })}
        </View>
      ))}
    </View>
  );

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <View style={styles.filterButtons}>
          {(['week', 'month', 'all'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.filterButtonActive
              ]}
              onPress={() => setFilter(filterOption)}>
              <Text style={[
                styles.filterButtonText,
                filter === filterOption && styles.filterButtonTextActive
              ]}>
                {filterOption === 'week' ? 'This Week' : 
                 filterOption === 'month' ? 'This Month' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {Platform.OS === 'web' && records.length > 0 && (
          <TouchableOpacity style={styles.exportButton} onPress={exportData}>
            <Download size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Records List */}
      <FlatList
        data={groupedRecords}
        renderItem={renderDayGroup}
        keyExtractor={(item) => item.date}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Clock size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptyText}>
              {filter === 'week' ? 'No time records this week' :
               filter === 'month' ? 'No time records this month' :
               'No time records found'}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
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
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  exportButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  dayGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayDate: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  dayHours: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#007AFF',
  },
  recordWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordItem: {
    paddingVertical: 8,
  },
  recordHeader: {
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
  recordInfo: {
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
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 44,
  },
  locationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});