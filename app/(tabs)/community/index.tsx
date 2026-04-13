import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { formatRelative } from '../../../src/lib/helpers';
import type { CommunityQuestion } from '../../../src/types/database';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'פתוחה', color: COLORS.yellow },
  answered: { label: 'נענתה', color: COLORS.green },
  closed: { label: 'סגורה', color: COLORS.gray },
};

export default function CommunityQuestionsScreen() {
  const { user } = useAuthStore();
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'answered'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, [filter]);

  const fetchQuestions = async () => {
    setLoading(true);
    let query = supabase
      .from('community_questions')
      .select('*, asker:users(full_name, avatar_url)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);

    const { data } = await query;
    setQuestions((data || []) as CommunityQuestion[]);
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!newQuestion.trim() || !user) return;

    const { error } = await supabase.from('community_questions').insert({
      question: newQuestion.trim(),
      asked_by: user.id,
    });

    if (error) {
      Alert.alert('שגיאה', 'לא ניתן לפרסם את השאלה');
    } else {
      setNewQuestion('');
      setShowModal(false);
      fetchQuestions();
    }
  };

  const renderQuestion = ({ item }: { item: CommunityQuestion }) => {
    const status = STATUS_LABELS[item.status] || STATUS_LABELS.open;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelative(item.created_at)}</Text>
        </View>
        <Text style={styles.questionText}>{item.question}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.askerText}>
            {(item as any).asker?.full_name || 'אנונימי'}
          </Text>
          <TouchableOpacity style={styles.answerBtn}>
            <Ionicons name="chatbubble" size={14} color={COLORS.primary} />
            <Text style={styles.answerBtnText}>ענה</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>הקהילה שואלת</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'הכל' },
          { key: 'open', label: 'פתוחות' },
          { key: 'answered', label: 'נענו' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key as any)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={questions}
        renderItem={renderQuestion}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="help-circle-outline"
            title="אין שאלות"
            subtitle="שאל את השאלה הראשונה!"
          />
        }
      />

      {/* Ask Question Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>שאלה חדשה</Text>
              <View style={{ width: 24 }} />
            </View>
            <TextInput
              style={styles.questionInput}
              placeholder="מה תרצה לשאול את הקהילה?"
              placeholderTextColor={COLORS.grayLight}
              value={newQuestion}
              onChangeText={setNewQuestion}
              multiline
              textAlignVertical="top"
              textAlign="right"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.submitBtn, !newQuestion.trim() && styles.submitBtnDisabled]}
              onPress={handleAsk}
              disabled={!newQuestion.trim()}
            >
              <Text style={styles.submitBtnText}>פרסם שאלה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primaryDark,
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
    paddingTop: SPACING.sm,
  },
  askerText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  answerBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  answerBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  questionInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.black,
    minHeight: 120,
    writingDirection: 'rtl',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOWS.button,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
