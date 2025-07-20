import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { View, ActivityIndicator, Text, StyleSheet, LogBox } from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useAuth } from '@/hooks/useAuth';
import { cleanupSupabase } from '@/lib/supabase';

// Suppress specific warnings that might interfere with Expo Router
LogBox.ignoreLogs([
  'Warning: Failed prop type',
  'Sending `onAnimatedValueUpdate`',
  'Non-serializable values were found in the navigation state',
  'ReferenceError: window is not defined',
  'Setting a timer for a long period of time',
]);

function ErrorFallback({ error }: { error: Error }) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{error.message}</Text>
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  const { session, initialized, error, connectionStatus } = useAuth();

  // Initialize any global configurations
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      cleanupSupabase();
    };
  }, []);

  if (!fontsLoaded || !initialized || connectionStatus === 'connecting') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {!fontsLoaded ? 'Loading fonts...' : 
           connectionStatus === 'connecting' ? 'Connecting to server...' :
           'Loading application...'}
        </Text>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>
          Unable to connect to server. Please check your internet connection.
        </Text>
        <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Retrying...</Text>
      </View>
    );
  }
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
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
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});