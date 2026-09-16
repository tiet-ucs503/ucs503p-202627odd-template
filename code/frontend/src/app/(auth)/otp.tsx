import { useState } from 'react';
import { Pressable, TextInput, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/context/session';

export default function OtpScreen() {
    const theme = useTheme();
    const session = useSession();
    const { email } = useLocalSearchParams<{ email: string }>();
    const [otp, setOtp] = useState('');

    function handleVerify() {
        // Mock verification: any 6-digit code works for now.
        // Real version will call POST /api/auth/verify-otp here.
        session.login();
        router.replace('/(student)');
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.container}>
                <ThemedText type="title" style={styles.title}>Verify OTP</ThemedText>
                <ThemedText themeColor="textSecondary">Code sent to {email}</ThemedText>

                <TextInput
                    placeholder="6-digit code"
                    placeholderTextColor={theme.textSecondary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />

                <Pressable style={[styles.button, { backgroundColor: theme.text }]} onPress={handleVerify}>
                    <ThemedText themeColor="background" type="smallBold">Verify & Continue</ThemedText>
                </Pressable>
            </ThemedView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
    title: { fontSize: 28, marginBottom: Spacing.one },
    input: { borderWidth: 1, borderRadius: 8, padding: Spacing.three, fontSize: 16, textAlign: 'center' },
    button: { borderRadius: 8, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});