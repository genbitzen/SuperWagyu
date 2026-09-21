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
  RefreshControl,
  Linking
} from 'react-native';

const API_BASE_URL = 'http://localhost:3001';

interface MonitoredProduct {
  id: string;
  url: string;
  status: 'IDLE' | 'MONITORING' | 'STOPPED' | 'ERROR';
  last_availability: 'UNKNOWN' | 'OUT_OF_STOCK' | 'IN_STOCK';
  last_checked_at?: string | null;
}

interface ReservationResult {
  id: string;
  product_id: string;
  product_url: string;
  order_id: string;
  status: 'RESERVED' | 'FAILED' | 'EXPIRED' | 'PAID';
  reserved_at: string;
  expires_at: string;
}

interface AvailabilityEvent {
  id: string;
  product_id: string;
  previous_state: string;
  new_state: string;
  detected_at: string;
  reservation?: ReservationResult | null;
}

interface SessionStatus {
  is_valid: boolean;
  user_id?: string;
  last_authenticated_at?: string;
  provider: string;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [products, setProducts] = useState<MonitoredProduct[]>([]);
  const [events, setEvents] = useState<AvailabilityEvent[]>([]);
  const [session, setSession] = useState<SessionStatus | null>(null);
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

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (err) {
      console.log('Error fetching events:', err);
    }
  };

  const fetchSessionStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/session/status`);
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      }
    } catch (err) {
      console.log('Error fetching session status:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchEvents();
    fetchSessionStatus();
    const interval = setInterval(() => {
      fetchProducts();
      fetchEvents();
    }, 2000);
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
        await fetchProducts();
        await fetchEvents();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to simulate restock');
    }
  };

  const handleOpenLazadaOrders = async () => {
    const lazadaAppUrl = 'lazada://account/orders';
    const lazadaWebUrl = 'https://member.lazada.sg/user/order/list';

    try {
      const canOpen = await Linking.canOpenURL(lazadaAppUrl);
      if (canOpen) {
        await Linking.openURL(lazadaAppUrl);
      } else {
        await Linking.openURL(lazadaWebUrl);
      }
    } catch (err) {
      Linking.openURL(lazadaWebUrl);
    }
  };

  const recentReservations = events.filter((e) => e.reservation && e.reservation.status === 'RESERVED');

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
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>SuperWagyu</Text>
          <View style={[styles.sessionBadge, session?.is_valid ? styles.sessionValid : styles.sessionInvalid]}>
            <Text style={styles.sessionBadgeText}>
              {session?.is_valid ? '⚡ Auto-Reserve Active' : '⚠️ Session Expired'}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Lazada Automated Restock & Reserve</Text>
      </View>

      {recentReservations.length > 0 && (
        <View style={styles.reservationBanner}>
          <Text style={styles.reservationTitle}>🎉 Active Stock Reservations</Text>
          {recentReservations.map((event) => (
            <View key={event.id} style={styles.reservationItem}>
              <View style={styles.reservationDetails}>
                <Text style={styles.reservationOrderText}>Order #{event.reservation?.order_id}</Text>
                <Text style={styles.reservationNotice}>Status: RESERVED (Pay in Lazada)</Text>
              </View>
              <TouchableOpacity style={styles.payButton} onPress={handleOpenLazadaOrders}>
                <Text style={styles.payButtonText}>Open Lazada to Pay ➔</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

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
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  sessionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  sessionValid: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)'
  },
  sessionInvalid: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)'
  },
  sessionBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4
  },
  reservationBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#1E1B4B',
    borderColor: '#6366F1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14
  },
  reservationTitle: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8
  },
  reservationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#312E81',
    padding: 10,
    borderRadius: 8
  },
  reservationDetails: {
    flex: 1
  },
  reservationOrderText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  reservationNotice: {
    color: '#C7D2FE',
    fontSize: 11,
    marginTop: 2
  },
  payButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
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
