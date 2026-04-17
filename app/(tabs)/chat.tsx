import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useMeditStore } from '../../src/stores/meditStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { MeditMessage } from '../../src/types/database';

export default function ChatScreen() {
  const router = useRouter();
  const { messages, loading, sendMessage, startNewSession } = useMeditStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const firstName = user?.full_name?.split(' ')[0] || '';

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const renderMessage = ({ item }: { item: MeditMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && (
          <View style={styles.meditAvatar}>
            <Text style={styles.flowerIcon}>🌸</Text>
          </View>
        )}
        <View style={[styles.messageContent, isUser ? styles.userContent : styles.assistantContent]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  // Group messages into conversations by time gaps (>30 min = new conversation)
  const getConversationPreviews = () => {
    if (messages.length === 0) return [];
    const conversations: { firstMsg: string; timestamp: number; count: number }[] = [];
    let currentConv = { firstMsg: '', timestamp: 0, count: 0 };

    messages.forEach((msg, i) => {
      if (i === 0 || msg.timestamp - messages[i - 1].timestamp > 30 * 60 * 1000) {
        if (currentConv.count > 0) conversations.push(currentConv);
        const preview = msg.role === 'user' ? msg.content : messages[i + 1]?.content || msg.content;
        currentConv = { firstMsg: preview.slice(0, 60), timestamp: msg.timestamp, count: 1 };
      } else {
        currentConv.count++;
      }
    });
    if (currentConv.count > 0) conversations.push(currentConv);
    return conversations.reverse();
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeLogo}>
        <Text style={styles.welcomeFlower}>🌸</Text>
      </View>
      <Text style={styles.welcomeTitle}>CHATMED</Text>

      <View style={styles.greetingCard}>
        <Text style={styles.greetingText}>
          אהלן{firstName ? ` ${firstName}` : ''}, מה מתחשק לך לעשות היום ביחד?
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerFlower}>🌸</Text>
          <Text style={styles.headerText}>CHATMED</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowHistory(true)}>
            <Ionicons name="time-outline" size={22} color={COLORS.gray} />
          </TouchableOpacity>
          <TouchableOpacity onPress={startNewSession}>
            <Ionicons name="add-outline" size={24} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {messages.length === 0 ? (
          renderWelcome()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.typingIndicator}>
            <View style={styles.meditAvatarSmall}>
              <Text style={{ fontSize: 10 }}>🌸</Text>
            </View>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>CHATMED מקליד...</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="שאל את CHATMED..."
            placeholderTextColor={COLORS.grayLight}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            textAlign="right"
            onSubmitEditing={handleSend}
          />
        </View>
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.historyOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.historyHeader}>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.historyTitle}>היסטוריית שיחות</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.historyList}>
              {getConversationPreviews().length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Ionicons name="chatbubbles-outline" size={40} color={COLORS.grayLight} />
                  <Text style={styles.historyEmptyText}>אין שיחות קודמות</Text>
                </View>
              ) : (
                getConversationPreviews().map((conv, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.historyItem}
                    onPress={() => setShowHistory(false)}
                  >
                    <View style={styles.historyItemIcon}>
                      <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.historyItemInfo}>
                      <Text style={styles.historyItemText} numberOfLines={1}>{conv.firstMsg}</Text>
                      <Text style={styles.historyItemMeta}>
                        {conv.count} הודעות · {new Date(conv.timestamp).toLocaleDateString('he-IL')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  headerFlower: {
    fontSize: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  messageBubble: {
    flexDirection: 'row-reverse',
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  userBubble: {
    justifyContent: 'flex-start',
  },
  assistantBubble: {
    justifyContent: 'flex-end',
  },
  meditAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  flowerIcon: {
    fontSize: 16,
  },
  messageContent: {
    maxWidth: '80%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  userContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantContent: {
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: 4,
    ...SHADOWS.card,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  userText: {
    color: COLORS.white,
  },
  typingIndicator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  meditAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.grayLight,
    backgroundColor: COLORS.cream,
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
    ...SHADOWS.button,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.grayLight,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  welcomeLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  welcomeFlower: {
    fontSize: 40,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 2,
    marginBottom: SPACING.lg,
  },
  greetingCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    alignSelf: 'stretch',
    ...SHADOWS.card,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'center',
    lineHeight: 28,
  },
  // History modal
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  historyModal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  historyHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.grayLight,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  historyList: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  historyEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  historyEmptyText: {
    fontSize: 15,
    color: COLORS.gray,
  },
  historyItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  historyItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  historyItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  historyItemMeta: {
    fontSize: 12,
    color: COLORS.gray,
  },
});
