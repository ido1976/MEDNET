-- ============================================================
-- MATMON.AI — Demo Seed Data
-- הוראות: הרץ ב-Supabase Studio > SQL Editor
-- ============================================================

DO $$
DECLARE
  demo_user UUID;
  bridge_mesar UUID;
  bridge_chinuch UUID;
  bridge_bitachon UUID;
  bridge_afula UUID;
BEGIN

-- משתמש הדמו — הראשון בטבלה, או שנה ל-UUID ספציפי
demo_user := (SELECT id FROM users LIMIT 1);

-- ============================================================
-- גשר 1: מסר היום
-- ============================================================
INSERT INTO bridges (name, description, created_by, status)
VALUES (
  'מסר היום — 3.5.26',
  'המסר המרכזי של המטה להיום. כל הפעילים מקבלים גרסה זהה.',
  demo_user, 'active'
) RETURNING id INTO bridge_mesar;

INSERT INTO discussions (title, bridge_id, tag, created_by) VALUES
  ('השאלה שעלתה הכי הרבה היום בשטח', bridge_mesar, 'שטח', demo_user),
  ('איך פותחים את השיחה עם בוחר מתלבט?', bridge_mesar, 'טיפים', demo_user);

INSERT INTO bridge_tips (bridge_id, user_id, content) VALUES
  (bridge_mesar, demo_user, 'בחיפה צפון עבד לי לפתוח עם שאלה על בית הספר של הילדים — אחרי זה נכנסים לנושא החינוך בטבעיות');

-- ============================================================
-- גשר 2: מצע חינוך
-- ============================================================
INSERT INTO bridges (name, description, created_by, status)
VALUES (
  'מצע חינוך',
  'עמדת המפלגה בנושא מערכת החינוך. נקודות הסבר, שאלות נפוצות מבוחרים, ותגובות מנוסות מהשטח.',
  demo_user, 'active'
) RETURNING id INTO bridge_chinuch;

INSERT INTO discussions (title, bridge_id, tag, created_by) VALUES
  ('שאלות נפוצות מבוחרים על תקציב החינוך', bridge_chinuch, 'שאלות', demo_user),
  ('עדכון: עמדת המפלגה על בחינות הבגרות', bridge_chinuch, 'עדכון מטה', demo_user);

INSERT INTO bridge_tips (bridge_id, user_id, content) VALUES
  (bridge_chinuch, demo_user, 'כשמדברים על חינוך — להתחיל תמיד מהמורה ולא מהתקציב. ההורים מתחברים לאנשים, לא לנתונים');

-- ============================================================
-- גשר 3: תגובה לפרסום היריב — ביטחון
-- ============================================================
INSERT INTO bridges (name, description, created_by, status)
VALUES (
  'תגובה לפרסום היריב — ביטחון',
  'עמדתנו בתגובה לפרסום האחרון של המתחרה. כולל ניסוחים מוכנים וטיפים מהשטח.',
  demo_user, 'active'
) RETURNING id INTO bridge_bitachon;

INSERT INTO discussions (title, bridge_id, tag, created_by) VALUES
  ('ניסוחים שעבדו בשטח — לא לפרסם', bridge_bitachon, 'פנימי', demo_user);

INSERT INTO bridge_tips (bridge_id, user_id, content) VALUES
  (bridge_bitachon, demo_user, 'אל תתקוף את הפרסום ישירות — שאל "מה הפתרון שלו?" זה מוציא את הרוח מהמפרשים שלהם תוך 10 שניות');

-- ============================================================
-- גשר 4: אירוע עפולה 12.5
-- ============================================================
INSERT INTO bridges (name, description, created_by, status)
VALUES (
  'אירוע עפולה 12.5',
  'עצרת ציבורית בעפולה — 12.5.26, 19:00, כיכר העצמאות. לוגיסטיקה, משימות הכנה, ורשימת משתתפים.',
  demo_user, 'active'
) RETURNING id INTO bridge_afula;

INSERT INTO discussions (title, bridge_id, tag, created_by) VALUES
  ('משימות הכנה לאירוע', bridge_afula, 'לוגיסטיקה', demo_user),
  ('תיאום הסעות מהאזור', bridge_afula, 'תיאום', demo_user);

INSERT INTO bridge_tips (bridge_id, user_id, content) VALUES
  (bridge_afula, demo_user, 'לדאוג לצוות קבלת פנים ב-18:30 לפחות — האנרגיה בכניסה קובעת את האווירה של כל הערב');

RAISE NOTICE 'Seed completed: 4 campaign bridges created.';
END $$;
