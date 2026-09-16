import { useState } from 'react';
import { Pressable, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterScreen() {
    const theme = useTheme();
    const [name, setName] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [phone, setPhone] = useState('');

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.container}>
                <ThemedText type="title" style={styles.title}>Register</ThemedText>

                <TextInput placeholder="Full name" placeholderTextColor={theme.textSecondary}
                    value={name} onChangeText={setName}
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
                <TextInput placeholder="Roll number (e.g. 24COE123)" placeholderTextColor={theme.textSecondary}
                    value={rollNo} onChangeText={setRollNo} autoCapitalize="characters"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
                <TextInput placeholder="Phone number" placeholderTextColor={theme.textSecondary}
                    value={phone} onChangeText={setPhone} keyboardType="phone-pad"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />

                <Pressable style={[styles.button, { backgroundColor: theme.text }]}
                    onPress={() => router.push('/(auth)/hostel-select')}>
                    <ThemedText themeColor="background" type="smallBold">Continue</ThemedText>
                </Pressable>
            </ThemedView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
    title: { fontSize: 28, marginBottom: Spacing.two },
    input: { borderWidth: 1, borderRadius: 8, padding: Spacing.three, fontSize: 16 },
    button: { borderRadius: 8, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});