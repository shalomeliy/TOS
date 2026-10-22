# HANDOFF - TOS Trainer (בסגנון Navis N4)

עודכן: 2026-10-22. הקובץ הזה הוא היומן של העבודה: איפה עומדים, מה הבא, ומה למדנו.
התוכנית של 20 הגרסאות נמצאת ב-`docs/ROADMAP.md`. בסוף כל גרסה מעדכנים כאן את הטבלה ואת "הצעד הבא".

## סטטוס גרסאות

| # | גרסה | סטטוס | הערה |
|---|---|---|---|
| 1 | בסיס הסימולטור | **הושלם** | commit `fac898c`, נדחף ל-`origin/main`. בדיקה: `node tools/smoke.mjs` עוברת |
| 2 | תוכנית העמסה אוטומטית | **בעבודה: מסמך דרישות** | `docs/specs/stowage-plan.md`, מחכה לאישור Shalom על 2 החלטות |
| 3 | תרגול תכנון העמסה | לא התחיל | |
| 4 | מכולה מול ביקור של מכולה | לא התחיל | הצעת הסכמה: סעיף 9 ב-`N4-data-model-research.md` |
| 5 | לוח זמנים ורציף | לא התחיל | |
| 6 | רכבת | לא התחיל | |
| 7 | תיאום תורים למשאיות | לא התחיל | |
| 8 | הגדרת חוקי חצר | לא התחיל | |
| 9 | עיכובים והרשאות | לא התחיל | |
| 10 | קירור ומטען מסוכן | לא התחיל | |
| 11 | משתמשים ותפקידים | לא התחיל | |
| 12 | מסלולי וזמני נסיעה | לא התחיל | |
| 13 | תקלות ציוד ויעילות עגורנים | לא התחיל | |
| 14 | מטען המשך | לא התחיל | |
| 15 | הודעות בין מערכות (EDI) | לא התחיל | |
| 16 | חיוב מורחב | לא התחיל | |
| 17 | דוחות ומדדים | לא התחיל | |
| 18 | מצב הדרכה ותרגילים | לא התחיל | |
| 19 | שמירה ותרחישים | לא התחיל | |
| 20 | ליטוש ואריזה | לא התחיל | |

## הצעד הבא
גרסה 2: לקבל מ-Shalom תשובה על ההחלטות הפתוחות במסמך הדרישות (מאיפה מגיע נמל היעד, והאם הפרת חוק חוסמת או רק מזהירה). אחר כך ניסוי קטן (spike) על סדר ההעמסה מול סדר החצר, תוכנית ב-`docs/plans/stowage-plan-PLAN.md`, ובנייה.

## מצב הקוד
- `index.html`: הסימולטור (TOS Trainer), קובץ אחד בלי תלויות. מצב נשמר ב-localStorage במפתח `tos-trainer-v1`. אין עדיין מספר גרסה במצב השמור ואין המרה של שמירות ישנות; צריך להוסיף `normalize()` בגרסה 2.
  - פונקציות מרכזיות: `fresh`, `addUnit`, `addVisit`, `planSlot` (בחירת מקום בחצר), `retrieve` (חפירה + rehandles), `newWI`, `tryDispatch`, `complete`, `cycle`, `startWork`, `depart`, מסכים ב-`VIEWS`, פעולות ב-`ACTIONS` ו-`FORMS`.
  - `window.TOS` חשוף לבדיקות.
- `tools/smoke.mjs`: בדיקה אוטומטית ב-Playwright. אם הדפדפן של Playwright חסר, משתמש ב-Chromium שכבר במחשב.
- `lab-v1.html`: הגרסה הראשונה מהסשן בענן (נשמרה לעיון, לא מתוחזקת).
- `N4-data-model-research.md`: מחקר מבנה הנתונים של N4 ממקורות ציבוריים.

## החלטות ולקחים
- הקוד נשאר בקובץ אחד עד בערך 1000 שורות. ES modules לא עובדים מ-`file://` (הבדיקה טוענת כך), אז פיצול עתידי יהיה ל-`<script src>` רגילים.
- רוחב מסך טלפון: עמודות grid צריכות `minmax(0,1fr)`, אחרת הדף גולש הצידה.
- `Math.random` בזריעה (משקלים, עיכובים) הופך בדיקות ללא דטרמיניסטיות. לקבע לפני שבודקים חוקי משקל.

## מה נמצא במחקר (מקורות ציבוריים)

| נושא | ממצא |
|---|---|
| תחומים | ספינות, חצר, שער, רכבת, תורים/appointments, חיוב |
| מודולי אופטימיזציה | Expert Decking (תכנון חצר לפי חוקים), PrimeRoute (ניתוב רכבי חצר), Vessel Autostow, RTG Optimization |
| אוטומציה | N4 שולח משימות ל-ECS (מערכת בקרת ציוד). מעליו ASC Manager (מנופי ערימה) ו-AHT/AGV Manager |
| ארכיטקטורה | Java/J2EE, חוקים מונחי metadata, גרסת SaaS. Navis שייכת ל-Kaleris |
| מודל נתונים | **Unit** (זהות קבועה) נפרד מ-**Unit Facility Visit** (ביקור במסוף: מצב, מיקום, נשאים) |
| מצבי חיים | Advised -> Inbound -> EC/In -> Yard -> EC/Out -> Loaded -> Departed |
| Category | Domestic, Export, Import, Storage, Through, Transship |
| Carrier Visit | ספינה/רכבת/משאית. phases ידועים: Create, Working, Closed, Canceled, Archived |
| מיקום | block / row / tier, מיקום נוכחי ומתוכנן |
| Work Instruction | הוראה להזיז מכולה. מקובצות ב-Work Queues לכל Point of Work |

**לא נמצא ולא לנחש:** סכמת הטבלאות המלאה, שמות enum מדויקים, קודי סוגי מהלך, מבנה Holds ותעריפים.

**מקורות:** Kaleris Automation Product Sheet; Long Beach Container Terminal case study; porttechnology.org (N4 3.8); N4 3.6.34 Cargo Manual (scribd); Port Newark N4 User Guide; Biznovate N4 training deck; Fenix FCI API Specs 1.5.0; N4 Customization Guide - Groovy; N4 Public APIs 4.0.6 (scribd); Navis crane automation API.

## הגבלות קבועות
- קוד מקורי בלבד. לא להעתיק קוד, נכסים או צילומי מסך מ-Navis/Kaleris או מכל TOS מסחרי.
- המראה "בסגנון N4", לא העתק, ולהגיד את זה במפורש.
- Shalom אינו מתכנת: הסברים בעברית, מילים פשוטות.
- push ל-GitHub רק כש-Shalom מבקש.
