import { useState } from 'react';
import { Pressable, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
    const theme = useTheme();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    function handleSendOtp() {
        if (!email.toLowerCase().endsWith('@thapar.edu')) {
            setError('Please use your college email (@thapar.edu).');
            return;
        }
        setError('');
        router.push({ pathname: '/(auth)/otp', params: { email } });
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.container}>
                <ThemedText type="title" style={styles.title}>Hostel Laundry</ThemedText>
                <ThemedText type="subtitle" style={styles.subtitle}>Student Login</ThemedText>

                <TextInput
                    placeholder="you@thapar.edu"
                    placeholderTextColor={theme.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
                {error ? <ThemedText themeColor="textSecondary" style={styles.error}>{error}</ThemedText> : null}

                <Pressable style={[styles.button, { backgroundColor: theme.text }]} onPress={handleSendOtp}>
                    <ThemedText themeColor="background" type="smallBold">Send OTP</ThemedText>
                </Pressable>

                <Pressable onPress={() => router.push('/(auth)/register')} style={styles.link}>
                    <ThemedText type="link" themeColor="textSecondary">New student? Register</ThemedText>
                </Pressable>
            </ThemedView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
    title: { fontSize: 28, marginBottom: Spacing.one },
    subtitle: { fontSize: 18, marginBottom: Spacing.three },
    input: { borderWidth: 1, borderRadius: 8, padding: Spacing.three, fontSize: 16 },
    button: { borderRadius: 8, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
    error: { fontSize: 13 },
    link: { alignItems: 'center', marginTop: Spacing.three },
});