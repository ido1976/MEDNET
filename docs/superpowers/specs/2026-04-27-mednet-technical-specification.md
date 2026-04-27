# דוח איפיון טכני - MEDNET

**תאריך:** 27 באפריל 2026
**גרסה:** 1.0
**מסמך:** Technical Specification Document

---

## 1. סקירה כללית

**MEDNET** הוא פלטפורמה קהילתית מבוססת-צ'אט (Chat-First) המיועדת לקהילת סטודנטים לרפואה ובני משפחותיהם. המערכת משלבת ידע משותף, מסחר פנים-קהילתי, תקשורת ועוזר AI חכם, תוך שמירה הרמטית על נתונים פנים-קהילתיים בלבד.

### עקרונות מנחים
- **Chat-First** — עוזר ה-AI (MEDIT/CHATMED) הוא הממשק הראשי
- **Community-Only Data** — אין מקורות נתונים חיצוניים
- **Hermetically Sealed** — בידוד מוחלט בין קהילות
- **Hebrew-First** — עברית כשפה ראשית עם תמיכת RTL מלאה

---

## 2. ארכיטקטורה טכנית

### 2.1 Stack טכנולוגי

| שכבה | טכנולוגיה | גרסה |
|------|-----------|------|
| Framework | Expo (React Native) | 54.0.33 |
| Runtime | React Native | 0.81.5 |
| React | React + React DOM | 19.1.0 |
| Routing | Expo Router | 6.0.23 |
| Web Support | react-native-web | 0.21.2 |
| Styling | NativeWind (Tailwind RN) | 2.0.11 |
| State Management | Zustand | 5.0.12 |
| Local Storage | AsyncStorage | 2.2.0 |
| Backend | Supabase | 2.102.1 |
| AI Engine | Anthropic Claude (claude-sonnet-4-6) | API |
| TypeScript | TypeScript | 5.9.2 |

### 2.2 ארכיטקטורת על

```
┌─────────────────────────────────────────────────┐
│  Clients: iOS / Android / Web (Expo Web)        │
└────────────────┬────────────────────────────────┘
                 │ HTTPS / WSS
┌────────────────▼────────────────────────────────┐
│  Supabase (BaaS)                                 │
│  ├─ Auth (JWT)                                   │
│  ├─ PostgreSQL + RLS                             │
│  ├─ Storage (תמונות דירות/גשרים)                │
│  ├─ Realtime (subscriptions)                     │
│  └─ Edge Functions (Deno)                        │
│        ├─ medit-chat                             │
│        └─ (פונקציות נוספות)                      │
└────────────────┬────────────────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────────────────┐
│  Anthropic Claude API (claude-sonnet-4-6)        │
│  עם Tool Use ל-CRUD פעולות מובנות               │
└─────────────────────────────────────────────────┘
```

### 2.3 ארגון תיקיות

```
MEDNET/
├── app/                  # Expo Router – מסכים ומסלולים
│   ├── (auth)/           # זרימת אימות
│   └── (tabs)/           # אזור מאומת
├── src/
│   ├── stores/           # 12 Zustand stores
│   ├── components/       # 14 רכיבים משותפים
│   ├── lib/              # Supabase client
│   ├── types/            # TypeScript interfaces
│   └── constants/        # Theme, colors, MEDIT consts
├── supabase/
│   ├── migrations/       # 15 SQL migrations
│   └── functions/        # 3 Edge Functions (Deno)
├── docs/superpowers/specs/  # דוקומנטציית פרויקט
├── scripts/              # סקריפטים פנימיים (migration runner)
└── assets/               # אייקונים, splash, favicon
```

---

## 3. מודל נתונים (Database Schema)

### 3.1 טבלאות ליבה

| טבלה | תפקיד |
|------|-------|
| `users` | פרופיל משתמש מורחב (סטטוס משפחתי, ישוב, שנת לימודים, פרטנר) |
| `user_children` | פרופילי ילדים של משתמשים |
| `bridges` | "גשרים" – משאבי ידע היררכיים (parent_id) |
| `bridge_tags` / `bridge_tag_assignments` | תגיות נושאיות |
| `bridge_files` / `bridge_updates` | קבצים ועדכונים לגשרים |
| `tips` | טיפים בתוך גשר |
| `additions` | הצעות תוספות לגשר |
| `discussions` | דיונים מרושרשים |
| `messages` | הודעות בדיונים |
| `direct_messages` | הודעות אישיות בין משתמשים |
| `events` | אירועים קהילתיים |
| `event_rsvps` | הרשמות (going / maybe / not_going) |
| `event_categories` | קטגוריות אירועים |
| `apartments` | מודעות דירות + analytics |
| `apartment_pending_checks` | תזכורות רלוונטיות מודעות |
| `secondhand_listings` | יד שנייה (product / service / giveaway) |
| `rides` | טרמפים |
| `prices` | דיווחי מחירים |
| `community_questions` | שאלות קהילה |
| `friendships` / `friend_requests` | חברויות |
| `user_circles` | מעגלים אוטומטיים (year, settlement, interest, custom) |
| `ratings` | דירוגים |
| `invite_tokens` | טוקנים להזמנות |

### 3.2 User Context Engine

| טבלה | תפקיד |
|------|-------|
| `user_activity` | תיעוד אינטראקציות (view, create, react, search, bookmark, share) |
| `user_search_history` | היסטוריית חיפושים |
| `user_tag_subscriptions` | מעקב משתמש אחרי תגיות |
| `pending_actions` | פעולות ממתינות (השלמת פרופיל, חידוש מודעה) |
| `notification_preferences` | העדפות התראות לפי ערוץ וסוג |
| `medit_usage` | מעקב שימוש ב-AI (rate limits) |

### 3.3 שכבת AI / צ'אט

| טבלה | תפקיד |
|------|-------|
| `chat_sessions` | סשנים של MEDIT/CHATMED |
| `chat_messages` | הודעות הצ'אט (היסטוריה מלאה) |

### 3.4 אבטחה ברמת הנתון
- **Row Level Security (RLS)** מופעל בכל הטבלאות הרגישות
- משתמש רואה רק את הנתונים שלו או נתונים פומביים
- תפקידים: `student` (ברירת מחדל), `moderator`, `admin`
- סוגי משתמש: `student`, `family_member`
- חיבור פרטנרים – `link_partner()` RPC לסנכרון דו-כיווני

---

## 4. Routing ומסכים

### 4.1 זרימת אימות `(auth)`
- `/welcome` – מסך פתיחה
- `/register` – הרשמה
- `/login` – התחברות
- `/onboarding` – השלמת פרופיל רב-שלבית

### 4.2 אזור מאומת `(tabs)`
- `/` – פיד ראשי
- `/chat` – עוזר ה-AI (MEDIT/CHATMED)
- `/discover` – גילוי תוכן וחיפוש
- `/profile` – פרופיל אישי
- `/bridges` + `/[id]` – גשרי ידע
- `/discussions` + `/[id]` – דיונים
- `/events` + `/[id]` – אירועים
- `/apartments` + `/[id]` – דירות
- `/rides` + `/[id]` – טרמפים
- `/prices` + `/[id]` – מחירים
- `/messenger/[userId]` – הודעות אישיות
- `/community` + `/[id]` – שאלות קהילה
- `/secondhand` + `/[id]` – יד שנייה

---

## 5. ניהול state (Zustand)

12 stores ייעודיים, כל אחד אחראי על דומיין מוגדר:

| Store | אחריות |
|-------|---------|
| `authStore` | אימות, פרופיל, מנויי תגיות, חיבור פרטנר |
| `bridgeStore` | גשרים, תגיות, טיפים, תוספות, קבצים |
| `discussionStore` | דיונים, הודעות, real-time subscriptions |
| `eventStore` | אירועים, RSVP, לוח שנה |
| `secondhandStore` | מודעות יד שנייה |
| `meditStore` | סשני צ'אט עם sync ל-AsyncStorage |
| `messengerStore` | הודעות אישיות |
| `friendStore` | חברויות, בקשות, חיפוש משתמשים |
| `circleStore` | מעגלי משתמשים |
| `activityStore` | סטטיסטיקות תוכן |
| `notificationStore` | התראות והעדפות |
| `sharedListsStore` | דירות / טרמפים / מחירים |

**דפוס**: כל store עובד מול Supabase client מאומת, כך ש-RLS אוכף הרשאות. AsyncStorage משמש כ-cache offline (בעיקר לצ'אט).

---

## 6. רכיבי UI מרכזיים

14 רכיבים משותפים ב-`src/components/`:
`AdditionCard`, `BridgeCard`, `BridgeImagePicker`, `ChipPicker`, `DatePickerField`, `EmptyState`, `FloatingMedit`, `HamburgerMenu`, `NotificationBell`, `ScreenWrapper`, `StarRating`, `TagSearchModal`, `TagSelector`, `TipCard`.

---

## 7. עוזר AI – MEDIT / CHATMED

### 7.1 ארכיטקטורה
- **מנוע**: Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **שכבת ביניים**: Edge Function `medit-chat` (Deno)
- **Rate limit**: 50 הודעות ליום למשתמש
- **System prompt**: נבנה דינמית מ:
  - פרופיל משתמש
  - היסטוריית פעילות
  - פעולות ממתינות
  - מעגלים חברתיים

### 7.2 Tool Use זמינים
- `save_profile_field` – עדכון שדה פרופיל
- `save_child` / `update_child` – ניהול ילדים
- `delete_apartment` / `snooze_apartment_check` / `get_apartment_analytics`
- `delete_secondhand_listing` / `snooze_secondhand_check` / `get_secondhand_analytics`

### 7.3 התמדה
שיחות נשמרות ב-`chat_sessions` + `chat_messages`, עם sync ל-AsyncStorage לחוויית offline.

---

## 8. פיצ'רים ראשיים

| פיצ'ר | תיאור |
|--------|-------|
| **גשרים (Bridges)** | בסיסי ידע היררכיים שיתופיים עם טיפים, קבצים ודירוגים |
| **דיונים** | שיחות מרושרשות עם תגיות, מקושרות לגשרים/אירועים |
| **אירועים** | לוח שנה קהילתי + RSVP |
| **MEDIT/CHATMED** | עוזר AI מותאם אישית |
| **יד שנייה** | מוצרים / שירותים / מתנות |
| **דירות** | מודעות עם analytics (צפיות, גלילות, קליקים) |
| **טרמפים** | תיאום נסיעות |
| **מחירים** | דיווחי עלויות מהקהילה |
| **Messenger** | הודעות אישיות 1:1 |
| **קהילה (Q&A)** | לוח שאלות פתוח |
| **Activity Tracking** | תיעוד מלא להמלצות ופרסונליזציה |
| **User Circles** | קבוצות אוטומטיות (שנתון, יישוב, נושאי עניין) + מותאמות |

---

## 9. אינטגרציות חיצוניות

- **Supabase**: Auth, PostgreSQL, Storage, Realtime, Edge Functions
- **Anthropic Claude API**: צ'אט עם Tool Use
- **Expo SDK**: image-picker, document-picker, linear-gradient, status-bar, splash-screen, font, constants, linking
- **React Native libs**: gesture-handler, reanimated, safe-area-context, screens, keyboard-aware-scroll-view
- **Date-fns**: עיבוד תאריכים בפורמט `he-IL`

---

## 10. שפה ולוקליזציה

- **שפה ראשית**: עברית (כל ה-UI, prompts, הודעות מערכת)
- **כיווניות**: RTL מלא (NativeWind + תמיכה native של Expo)
- **תאריכים**: `toLocaleDateString('he-IL')`
- אין שימוש ב-i18n library; טקסטים hard-coded בעברית

---

## 11. אבטחה ופרטיות

| אמצעי | יישום |
|-------|--------|
| אימות | Supabase Auth (JWT) |
| הרשאות נתונים | RLS על כל טבלה רגישה |
| תפקידים | student / moderator / admin |
| אחסון מקומי | AsyncStorage (session + cache) |
| בידוד קהילתי | אין מקורות נתונים חיצוניים |
| Tokens | invite_tokens חד-פעמיים להצטרפות |
| Rate limiting | medit_usage לעוזר ה-AI |

> ⚠️ **שיקול רגולטורי**: אם המערכת תכלול PHI (Protected Health Information), נדרש לשדרג ל-Supabase Team עם BAA (HIPAA-compliant).

---

## 12. אסטרטגיית פריסה (Deployment)

### 12.1 קליינט
- **Mobile**: Expo EAS Build → App Store / Google Play
- **Web**: `expo export --platform web` → static hosting (Vercel / Netlify / Cloudflare Pages)

### 12.2 Backend
- **Supabase**: Managed (Free → Pro $25/mo → Team $599/mo for HIPAA)
- **Edge Functions**: deploy אוטומטי דרך Supabase CLI
- **Migrations**: 15 קבצי SQL ב-`supabase/migrations/`

### 12.3 Domains & Auth
- Custom domain ל-Web
- Deep linking ל-mobile (expo-linking)

---

## 13. דוקומנטציה קיימת

`docs/superpowers/specs/`:
- `2026-04-16-mednet-platform-vision-design.md` – חזון ושלבי פיתוח
- `2026-04-17-chatmed-phase2a-design.md` – פרסונליזציה והתמדת שיחות
- `2026-04-19-chatmed-profile-completion-design.md` – השלמת פרופיל דרך הצ'אט
- `2026-04-27-mednet-technical-specification.md` – המסמך הנוכחי

---

## 14. Roadmap

| שלב | תוכן | סטטוס |
|------|------|-------|
| **Phase 1** | Data Foundation + User Context Engine | בעבודה |
| **Phase 2** | Smart Chat (MEDIT/CHATMED מותאם אישית) | חלקי (2A) |
| **Phase 3** | Admin Panel + Analytics | מתוכנן |
| **Phase 4** | Multi-tenant Platform + Privacy | עתידי |

---

## 15. נקודות תורפה ידועות / נושאים פתוחים

1. **i18n**: אין תשתית רב-לשונית; אם תהיה הרחבה לקהילות נוספות – צריך i18n.
2. **HIPAA / רגולציה רפואית**: לא נבדק עדיין מול דרישות PHI.
3. **CI/CD**: אין pipeline אוטומטי בקוד; build ידני דרך Expo.
4. **Tests**: לא נצפו קבצי בדיקות (unit / integration / e2e).
5. **Monitoring**: אין שילוב Sentry / Crashlytics / Logflare כרגע.
6. **Backup strategy**: תלוי בגיבויי Supabase (יומיים ב-Pro).
7. **Cost monitoring**: אין מעקב אוטומטי על עלויות Claude API.

---

## 16. סיכום

MEDNET היא פלטפורמת קהילה מבוססת-AI עם ארכיטקטורה מודולרית, mobile-first עם תמיכת web, נשענת על Supabase כ-BaaS ועל Claude כמנוע שיחה. הליבה הטכנולוגית בנויה לתמוך בפרסונליזציה עמוקה דרך **User Context Engine** מקיף, ומאפשרת התרחבות עתידית למודל multi-tenant.
