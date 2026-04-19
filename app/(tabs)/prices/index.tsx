import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { formatDate } from '../../../src/lib/helpers';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import type { Price } from '../../../src/types/database';

function getReliabilityColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 50) return COLORS.yellow;
  return COLORS.red;
}

function getReliabilityLabel(score: number): string {
  if (score >= 80) return 'אמין מאוד';
  if (score >= 50) return 'אמין';
  return 'פחות אמין';
}

export default function PricesScreen() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('הכל');
  const [loading, setLoading] = useState(true);
  const { stores, categories, addStore, addCategory } = useSharedListsStore();
  const priceCategories = categories.prices || ['מזון', 'תחבורה', 'בילויים', 'ציוד לימודי', 'שירותים'];

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStore, setNewStore] = useState(stores[0] || '');
  const [newCategory, setNewCategory] = useState(priceCategories[0] || 'מזון');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('prices')
        .select('*, reporter:users(full_name)')
        .order('reported_at', { ascending: false });
      if (data && data.length > 0) setPrices(data as Price[]);
    } catch (e) {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newItem.trim()) { Alert.alert('שגיאה', 'נא להזין שם מוצר'); return; }
    if (!newPrice.trim()) { Alert.alert('שגיאה', 'נא להזין מחיר'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { Alert.alert('שגיאה', 'יש להתחבר קודם'); return; }

    setLoading(true);
    const { data, error } = await supabase
      .from('prices')
      .insert({
        reported_by: session.user.id,
        item_name: newItem,
        price: Number(newPrice),
        category: newCategory,
        reliability_score: 85,
        reported_at: new Date().toISOString(),
      })
      .select('*, reporter:users(full_name)')
      .single();
    setLoading(false);

    if (error) { Alert.alert('שגיאה', 'לא ניתן לדווח על המחיר'); return; }
    setPrices((prev) => [data as Price, ...prev]);
    setShowCreate(false);
    resetForm();
    Alert.alert('דווח!', 'המחיר דווח בהצלחה');
  };

  const resetForm = () => {
    setNewItem(''); setNewPrice(''); setNewStore(stores[0] || '');
    setNewCategory(priceCategories[0] || 'מזון'); setNewNotes('');
  };

  const allFilterCategories = ['הכל', ...priceCategories];

  const filteredPrices = prices.filter((p) => {
    const matchSearch = !search || p.item_name.includes(search);
    const matchCategory = selectedCategory === 'הכל' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const renderPrice = ({ item }: { item: Price }) => {
    const reliabilityColor = getReliabilityColor(item.reliability_score);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            {(item as any).store && <Text style={styles.storeName}>{(item as any).store}</Text>}
          </View>
          <Text style={styles.priceValue}>₪{item.price}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <View style={styles.reliabilityContainer}>
            <View style={styles.reliabilityBar}>
              <View style={[styles.reliabilityFill, { width: `${item.reliability_score}%`, backgroundColor: reliabilityColor }]} />
            </View>
            <Text style={[styles.reliabilityText, { color: reliabilityColor }]}>
              {getReliabilityLabel(item.reliability_score)} ({item.reliability_score}%)
            </Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>
            דווח ע״י {(item as any).reporter?.full_name || 'אנונימי'}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.reported_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>מחירון</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Price Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>דווח מחיר</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TextInput style={styles.modalInput} placeholder="שם המוצר/שירות *" value={newItem} onChangeText={setNewItem} textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <TextInput style={styles.modalInput} placeholder="מחיר ₪ *" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <ChipPicker
                label="קטגוריה:"
                items={priceCategories}
                selected={newCategory}
                onSelect={setNewCategory}
                onAddNew={(cat) => addCategory('prices', cat)}
                placeholder="קטגוריה חדשה..."
              />

              <ChipPicker
                label="חנות/מקום:"
                items={stores}
                selected={newStore}
                onSelect={setNewStore}
                onAddNew={addStore}
                placeholder="שם חנות חדשה..."
              />

              <TextInput style={[styles.modalInput, { height: 60 }]} placeholder="הערות (מבצע, תוקף, גודל אריזה...)" value={newNotes} onChangeText={setNewNotes} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />

              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>דווח מחיר</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput style={styles.searchInput} placeholder="חפש מוצר או שירות..." placeholderTextColor={COLORS.grayLight} value={search} onChangeText={setSearch} textAlign="right" />
      </View>

      <FlatList
        horizontal
        data={allFilterCategories}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.catChip, selectedCategory === item && styles.catChipActive]} onPress={() => setSelectedCategory(item)}>
            <Text style={[styles.catText, selectedCategory === item && styles.catTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catsRow}
        style={styles.catsContainer}
      />

      <FlatList
        data={filteredPrices}
        renderItem={renderPrice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="pricetag-outline" title="אין מחירים" subtitle="דווח על מחיר חדש!" />}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primaryDark },
  searchContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, marginHorizontal: SPACING.lg, paddingHorizontal: SPACING.md, height: 46, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.grayLight },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  catsContainer: { marginTop: SPACING.md },
  catsRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  catChip: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.xl, backgroundColor: COLORS.cardBg, borderWidth: 1.5, borderColor: COLORS.grayLight },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
  catTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 100 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  itemName: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark, textAlign: 'right' },
  storeName: { fontSize: 13, color: COLORS.gray, textAlign: 'right', marginTop: 2 },
  priceValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  cardBody: { marginBottom: SPACING.sm },
  categoryBadge: { alignSelf: 'flex-end', backgroundColor: COLORS.primary + '15', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm, marginBottom: SPACING.sm },
  categoryText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  reliabilityContainer: { gap: 4 },
  reliabilityBar: { height: 6, backgroundColor: COLORS.grayLight, borderRadius: 3, overflow: 'hidden' },
  reliabilityFill: { height: '100%', borderRadius: 3 },
  reliabilityText: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.grayLight, paddingTop: SPACING.sm },
  reporterText: { fontSize: 12, color: COLORS.gray },
  dateText: { fontSize: 12, color: COLORS.grayLight },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right' },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
