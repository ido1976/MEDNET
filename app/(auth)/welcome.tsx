import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

const TOPIC_CARDS = [
  { icon: 'school', title: 'לימודים', desc: 'חומרי לימוד, סיכומים וטיפים', color: '#4A90D9' },
  { icon: 'people', title: 'קהילה', desc: 'הכר סטודנטים, שתף ותתחבר', color: '#E8734A' },
  { icon: 'home', title: 'דיור', desc: 'מצא דירה או שותפים בצפת', color: '#50B878' },
  { icon: 'car', title: 'טרמפים', desc: 'שתף נסיעות וחסוך', color: '#9B59B6' },
  { icon: 'calendar', title: 'אירועים', desc: 'מפגשים, הרצאות וסדנאות', color: '#F4C542' },
  { icon: 'chatbubble-ellipses', title: 'CHATMED', desc: 'העוזר החכם שלך', color: '#2d5a3d' },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Ionicons name="medical" size={42} color={COLORS.white} />
          </View>
          <Text style={styles.title}>MEDNET</Text>
          <Text style={styles.subtitle}>הקהילה של סטודנטים לרפואה בצפת</Text>
          <Text style={styles.tagline}>
            מקום אחד לכל מה שצריך – לימודים, דיור, טרמפים, אירועים ועוד
          </Text>
        </View>

        {/* Topic Cards - Pi.ai Style */}
        <View style={styles.cardsGrid}>
          {TOPIC_CARDS.map((card, index) => (
            <TouchableOpacity
              key={index}
              style={styles.topicCard}
              activeOpacity={0.85}
            >
              <View style={[styles.cardIcon, { backgroundColor: card.color + '15' }]}>
                <Ionicons name={card.icon as any} size={26} color={card.color} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryBtnText}>הרשמה</Text>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryBtnText}>כבר יש לי חשבון</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.button,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 17,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  cardsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  topicCard: {
    width: (width - SPACING.lg * 2 - SPACING.sm) / 2,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
    ...SHADOWS.card,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 18,
  },
  ctaContainer: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.button,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
