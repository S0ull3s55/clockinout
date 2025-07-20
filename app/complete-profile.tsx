import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  newPassword: string;
  confirmPassword: string;
}

export default function CompleteProfile() {
  const router = useRouter();
  const { token } = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    firstName: '',
    lastName: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (!token) {
      Alert.alert('Error', 'Invalid invitation link');
      router.replace('/');
    }
  }, [token]);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validate form
      if (!form.firstName || !form.lastName) {
        throw new Error('Please fill in all required fields');
      }

      if (form.newPassword !== form.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (form.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: form.newPassword,
      });

      if (passwordError) throw passwordError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          status: 'active',
        })
        .eq('id', token);

      if (profileError) throw profileError;

      Alert.alert(
        'Success',
        'Profile completed successfully! You can now sign in with your email and new password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/sign-in'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>Please provide your details to activate your account</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="First Name *"
          value={form.firstName}
          onChangeText={(text) => setForm({ ...form, firstName: text })}
        />

        <TextInput
          style={styles.input}
          placeholder="Last Name *"
          value={form.lastName}
          onChangeText={(text) => setForm({ ...form, lastName: text })}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={form.phone}
          onChangeText={(text) => setForm({ ...form, phone: text })}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="New Password *"
          value={form.newPassword}
          onChangeText={(text) => setForm({ ...form, newPassword: text })}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password *"
          value={form.confirmPassword}
          onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Completing Profile...' : 'Complete Profile'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
});