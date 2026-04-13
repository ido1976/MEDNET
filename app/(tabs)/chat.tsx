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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useMeditStore } from '../../src/stores/meditStore';
import { MEDIT_WELCOME_MESSAGES } from '../../src/constants/medit';
import type { MeditMessage } from '../../src/types/database';

const SUGGESTIONS = [
  'אילו גשרים יש ב-MEDNET?',
  'מה האירועים הקרובים?',
  'חפש לי דירה בצפת',
  'יש טרמפים לחיפה השבוע?',
];

export default function ChatScreen() {
  const router = useRouter();
  const { messages, loading, sendMessage, clearChat } = useMeditStore();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

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

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const renderMessage = ({ item }: { item: MeditMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && (
          <View style={styles.meditAvatar}>
            <Ionicons name="medical" size={16} color={COLORS.white} />
          </View>
        )}
        <View style={[styles.messageContent, isUser ? styles.userContent : styles.assistantContent]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeLogo}>
        <Ionicons name="medical" size={36} color={COLORS.white} />
      </View>
      <Text style={styles.welcomeTitle}>MEDIT</Text>
      <Text style={styles.welcomeSubtitle}>העוזר החכם של MEDNET</Text>

      {MEDIT_WELCOME_MESSAGES.map((msg, i) => (
        <View key={i} style={styles.welcomeMessage}>
          <Text style={styles.welcomeMessageText}>{msg}</Text>
        </View>
      ))}

      <Text style={styles.suggestionsTitle}>נסה לשאול:</Text>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((suggestion, i) => (
          <TouchableOpacity
            key={i}
            style={styles.suggestionCard}
            onPress={() => handleSuggestion(suggestion)}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
            <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        ))}
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
          <View style={styles.headerDot} />
          <Text style={styles.headerText}>MEDIT</Text>
        </View>
        <TouchableOpacity onPress={clearChat}>
          <Ionicons name="refresh" size={22} color={COLORS.gray} />
        </TouchableOpacity>
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
              <Ionicons name="medical" size={12} color={COLORS.white} />
            </View>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>MEDIT מקליד...</Text>
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
            placeholder="שאל את MEDIT..."
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
    gap: 8,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.green,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    letterSpacing: 1,
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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  welcomeLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.button,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 2,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  welcomeMessage: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    alignSelf: 'stretch',
    ...SHADOWS.card,
  },
  welcomeMessageText: {
    fontSize: 15,
    color: COLORS.primaryDark,
    textAlign: 'right',
    lineHeight: 22,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    alignSelf: 'flex-end',
  },
  suggestions: {
    alignSelf: 'stretch',
    gap: SPACING.sm,
  },
  suggestionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
