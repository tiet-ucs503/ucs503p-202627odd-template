import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PlaceholderScreen() {
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ThemedText type="title">This is the Dashboard</ThemedText>
            </ThemedView>
        </SafeAreaView>
    );
}