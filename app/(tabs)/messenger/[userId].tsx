import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useMessengerStore } from '../../../src/stores/messengerStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { formatTime } from '../../../src/lib/helpers';
import { supabase } from '../../../src/lib/supabase';
import type { DirectMessage, User } from '../../../src/types/database';

export default function DirectChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentMessages, fetchMessages, sendDirectMessage, markAsRead, subscribeToDirectMessages } =
    useMessengerStore();
  const [input, setInput] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId || !user) return;
    fetchMessages(user.id, userId);
    markAsRead(user.id, userId);
    loadOtherUser();
    const unsubscribe = subscribeToDirectMessages(user.id);
    return unsubscribe;
  }, [userId, user]);

  const loadOtherUser = async () => {
    if (!userId) return;
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (data) setOtherUser(data as User);
  };

  useEffect(() => {
    if (currentMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [currentMessages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !userId) return;
    const text = input.trim();
    setInput('');
    await sendDirectMessage(user.id, userId, text);
    fetchMessages(user.id, userId);
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isOwn = item.from_user_id === user?.id;
    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.timeStamp, isOwn && styles.ownTimeStamp]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherUser?.full_name || 'שיחה'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="כתוב הודעה..."
            placeholderTextColor={COLORS.grayLight}
            value={input}
            onChangeText={setInput}
            multiline
            textAlign="right"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.grayLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  messageRow: {
    flexDirection: 'row-reverse',
    marginBottom: SPACING.sm,
  },
  messageRowOwn: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  ownBubble: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 4,
  },
  otherBubble: {
    backgroundColor: COLORS.cardBg,
    borderBottomRightRadius: 4,
    ...SHADOWS.card,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.primaryDark,
    textAlign: 'right',
    lineHeight: 21,
  },
  ownMessageText: {
    color: COLORS.white,
  },
  timeStamp: {
    fontSize: 10,
    color: COLORS.grayLight,
    textAlign: 'left',
    marginTop: 2,
  },
  ownTimeStamp: {
    color: 'rgba(255,255,255,0.6)',
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.grayLight,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.black,
    maxHeight: 100,
    textAlign: 'right',
    writingDirection: 'rtl',
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.grayLight,
  },
});
