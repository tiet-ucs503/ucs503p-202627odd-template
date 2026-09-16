import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';

interface Hostel {
    id: string;
    code: string;
    name?: string;
}

const HOSTELS: Hostel[] = [
    { id: 'A', code: 'Hostel A', name: 'Agira Hall' },
    { id: 'B', code: 'Hostel B', name: 'Amritam Hall' },
    { id: 'C', code: 'Hostel C', name: 'Prithvi Hall' },
    { id: 'D', code: 'Hostel D', name: 'Neeram Hall' },
    { id: 'E', code: 'Hostel E', name: 'Vasudha Hall - Block E' },
    { id: 'G', code: 'Hostel G', name: 'Vasudha Hall - Block G' },
    { id: 'H', code: 'Hostel H', name: 'Vyan Hall' },
    { id: 'I', code: 'Hostel I', name: 'Ira Hall' },
    { id: 'J', code: 'Hostel J', name: 'Tejas Hall' },
    { id: 'K', code: 'Hostel K', name: 'Ambaram Hall' },
    { id: 'L', code: 'Hostel L', name: 'Viyat Hall' },
    { id: 'M', code: 'Hostel M', name: 'Anantam Hall' },
    { id: 'N', code: 'Hostel N', name: 'Ananta Hall' },
    { id: 'O', code: 'Hostel O', name: 'Vyom Hall' },
    { id: 'PG', code: 'Hostel PG', name: 'Dhriti Hall' },
    { id: 'Q', code: 'Hostel Q', name: 'Vahni Hall' },
    { id: 'PG2', code: 'Hostel PG-2', name: 'Pavani Hall' },
    { id: 'FRFG', code: 'Hostel-FRF/G' },
];

export default function HostelSelectScreen() {
    const theme = useTheme();
    const session = useSession();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    function handleConfirm() {
        if (!selectedId) return;
        session.login();
        router.replace('/(student)');
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <ThemedText type="title" style={styles.title}>Select Your Hostel</ThemedText>

                {HOSTELS.map((item) => (
                    <Pressable
                        key={item.id}
                        onPress={() => setSelectedId(item.id)}
                        style={[styles.option, selectedId === item.id && styles.optionSelected]}>
                        <ThemedText type="default">
                            {item.name ? `${item.code} (${item.name})` : item.code}
                        </ThemedText>
                    </Pressable>
                ))}

                <Pressable
                    style={[styles.button, { backgroundColor: theme.text, opacity: selectedId ? 1 : 0.4 }]}
                    disabled={!selectedId}
                    onPress={handleConfirm}>
                    <ThemedText themeColor="background" type="smallBold">Confirm & Continue</ThemedText>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { padding: Spacing.four, gap: Spacing.two },
    title: { fontSize: 28, marginBottom: Spacing.two },
    option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: Spacing.three },
    optionSelected: { borderColor: '#3c87f7', borderWidth: 2 },
    button: { borderRadius: 8, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
});