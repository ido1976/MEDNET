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
import { trackView } from '../../../src/lib/activityTracker';
import { useDiscussionStore } from '../../../src/stores/discussionStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { getInitials, formatTime } from '../../../src/lib/helpers';
import type { Message } from '../../../src/types/database';

export default function DiscussionChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentDiscussion, messages, fetchDiscussion, fetchMessages, sendMessage, subscribeToMessages } =
    useDiscussionStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    trackView('discussion', id);
    fetchDiscussion(id);
    fetchMessages(id);
    const unsubscribe = subscribeToMessages(id);
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !id) return;
    const text = input.trim();
    setInput('');
    await sendMessage(id, user.id, text);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.user_id === user?.id;
    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {!isOwn && (
          <View style={styles.avatar}>
            {item.user?.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>
                {item.user?.full_name ? getInitials(item.user.full_name) : '?'}
              </Text>
            )}
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {!isOwn && (
            <Text style={styles.senderName}>{item.user?.full_name}</Text>
          )}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentDiscussion?.title}
          </Text>
          <Text style={styles.headerSub}>
            {currentDiscussion?.participants_count} משתתפים
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/chat')}>
          <View style={styles.meditBadge}>
            <Text style={styles.meditBadgeText}>CHATMED</Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.gray,
  },
  meditBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.xl,
  },
  meditBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.md,
  },
  messageRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  messageRowOwn: {
    flexDirection: 'row',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 32,
    height: 32,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '75%',
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
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
    textAlign: 'right',
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
