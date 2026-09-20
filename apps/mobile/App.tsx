import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';

const API_BASE_URL = 'http://localhost:3001';

interface MonitoredProduct {
  id: string;
  url: string;
  status: 'IDLE' | 'MONITORING' | 'STOPPED' | 'ERROR';
  last_availability: 'UNKNOWN' | 'OUT_OF_STOCK' | 'IN_STOCK';
  last_checked_at?: string | null;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [products, setProducts] = useState<MonitoredProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.log('Error connecting to backend server:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddProduct = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid Lazada Product URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      if (response.ok) {
        setUrl('');
        await fetchProducts();
      } else {
        Alert.alert('Error', 'Failed to add product for monitoring');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMonitoring = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        fetchProducts();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update monitoring status');
    }
  };

  const handleSimulateRestock = async (id: string, productUrl: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mock/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, url: productUrl })
      });
      if (response.ok) {
        const res = await response.json();
        Alert.alert('Mock Restock', res.message);
        fetchProducts();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to trigger mock restock');
    }
  };

  const renderProductItem = ({ item }: { item: MonitoredProduct }) => {
    const isAvailable = item.last_availability === 'IN_STOCK';
    const isOutOfStock = item.last_availability === 'OUT_OF_STOCK';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.urlText} numberOfLines={2}>
            {item.url}
          </Text>
          <View
            style={[
              styles.statusBadge,
              item.status === 'MONITORING' ? styles.badgeMonitoring : styles.badgeStopped
            ]}
          >
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.availRow}>
            <Text style={styles.label}>Availability:</Text>
            <View
              style={[
                styles.availBadge,
                isAvailable
                  ? styles.availInStock
                  : isOutOfStock
                  ? styles.availOutOfStock
                  : styles.availUnknown
              ]}
            >
              <Text style={styles.availBadgeText}>
                {isAvailable ? 'IN STOCK' : isOutOfStock ? 'OUT OF STOCK' : 'UNKNOWN'}
              </Text>
            </View>
          </View>

          <Text style={styles.timeText}>
            Last Checked:{' '}
            {item.last_checked_at
              ? new Date(item.last_checked_at).toLocaleTimeString()
              : 'Never'}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              item.status === 'MONITORING' ? styles.stopButton : styles.startButton
            ]}
            onPress={() => handleToggleMonitoring(item.id)}
          >
            <Text style={styles.actionButtonText}>
              {item.status === 'MONITORING' ? 'Stop Monitoring' : 'Start Monitoring'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.simButton}
            onPress={() => handleSimulateRestock(item.id, item.url)}
          >
            <Text style={styles.simButtonText}>Simulate Restock</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Lazada Restock Monitor</Text>
        <Text style={styles.subtitle}>V0 — Monitoring Foundation</Text>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Paste Lazada Product URL..."
          placeholderTextColor="#6B7280"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddProduct} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.addButtonText}>Add Product</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchProducts();
              setRefreshing(false);
            }}
            tintColor="#3B82F6"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products currently configured.</Text>
            <Text style={styles.emptySubText}>Add a Lazada URL above to begin monitoring.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4
  },
  formContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  addButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10
  },
  urlText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeMonitoring: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)'
  },
  badgeStopped: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)'
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  cardBody: {
    marginTop: 12,
    gap: 6
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  label: {
    color: '#94A3B8',
    fontSize: 13
  },
  availBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6
  },
  availInStock: {
    backgroundColor: '#10B981'
  },
  availOutOfStock: {
    backgroundColor: '#EF4444'
  },
  availUnknown: {
    backgroundColor: '#64748B'
  },
  availBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  timeText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  startButton: {
    backgroundColor: '#059669'
  },
  stopButton: {
    backgroundColor: '#DC2626'
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  simButton: {
    backgroundColor: '#475569',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  simButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600'
  },
  emptySubText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4
  }
});
