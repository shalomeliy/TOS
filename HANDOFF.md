# HANDOFF - TOS Trainer (בסגנון Navis N4)

עודכן: 2026-10-22. הקובץ הזה הוא היומן של העבודה: איפה עומדים, מה הבא, ומה למדנו.
התוכנית של 20 הגרסאות נמצאת ב-`docs/ROADMAP.md`. בסוף כל גרסה מעדכנים כאן את הטבלה ואת "הצעד הבא".

## סיכום סגירת סשן (2026-10-22)

**מה נבנה בסשן:**
- הגדרת הפרויקט מתוך התבנית: `CLAUDE.md` (Project facts), `docs/PRODUCT-DIRECTION.md`, `.claude/launch.json`, `.gitignore`, `package.json` (playwright 1.64.1).
- `index.html` - TOS Trainer: אוניות, חצר (4 בלוקים, ערימות עד 4), מלאי מכולות (מספרי ISO 6346 עם ספרת ביקורת), שער (קבלה/מסירה, דחייה על עיכוב מכס), תורי עבודה, ציוד (2 QC, 4 AGV, ASC לכל בלוק), rehandles, חיוב (תעריפים, אחסנה אחרי ימי חינם, חשבוניות, תשלום, זיכוי), דף "How it maps to N4" בעברית.
- גרסה 1.1: בועות הסבר בעברית לכל כפתור/שדה/קישור, מסך Settings, תפריט עליון לחיץ.
- `tools/smoke.mjs` - בדיקה אוטומטית (יום עבודה מלא, בועות, הגדרות, רוחב טלפון). עוברת.
- תכנון: `docs/ROADMAP.md` (20 גרסאות), `docs/specs/stowage-plan.md` (מאושר), ניסוי + `docs/spikes/stowage-plan.md` (GO), `docs/research/ashdod-south-port.md`.
- החיבור ל-`shalomeliy/TOS` נעשה ע"י סשן אחר; הגרסה הישנה נשמרה כ-`lab-v1.html`.

**מה פתוח:**
1. ~~גרסה 2 - אשדוד~~: הושלם. כל ההחלטות ב-`DECISIONS.md`.
2. **שאלות פתוחות לאשדוד:** שבת לא נספרת באחסנה (Shalom החליט). עדיין ברירת מחדל: AGV בין רציף לחצר, רציף 28 = 445 מ'. אונייה שסיימה עבודה (COMPLETE) עדיין תופסת את הרציף עד שהיא יוצאת.
3. ~~Konecranes בדף ההסבר~~: נעשה בגרסה 2.
4. **גרסה 3 - תכנון העמסה:** לעדכן את מסמך הדרישות למנופי אשדוד ולהריץ שוב את הניסוי אחרי גרסה 2.
5. ~~שמירות ישנות~~: נפתר בגרסה 2 (`STATE_VER`, `normalize()`, `MIGRATE`).
6. HANDOFF הישן דיבר על פיצול Unit / UnitVisit; זה עכשיו גרסה 5 במפה.

## סטטוס גרסאות

| # | גרסה | סטטוס | הערה |
|---|---|---|---|
| 1 | בסיס הסימולטור | **הושלם** | commit `fac898c`, נדחף ל-`origin/main` |
| 1.1 | בועות הסבר + הגדרות עזרה | **הושלם** | 2026-10-22: נוספה בועה לכל מסך (סימן ? בכותרת, `SCREEN_TIPS`), והבדיקה נכשלת אם חסרה בועה. בועה בעברית לכל כפתור, שדה וקישור; מסך Settings להסתרת בועות ותיבות הסבר (נשמר בדפדפן, מפתח `tos-trainer-prefs`). בדיקה עוברת |
| 2 | נמל הדרום אשדוד (מוקטן פי 4) | **הושלם** | מסמך `docs/specs/ashdod-south-port.md` (D1=a, D2=a, D3=a), ניסוי GO `docs/spikes/ashdod-south-port.md`, תוכנית `docs/plans/ashdod-south-port-PLAN.md`. 2 רציפים, 2 QC, 4 AGV, 8 ASC (2 לכל בלוק), מסילה (תצוגה), הפסקת שבת, שעות שער, אחסנה בלי שבת, שמירה עם מספר גרסה + המרה. בדיקה עוברת |
| 3 | תוכנית העמסה אוטומטית | **הושלם** | מסמך `docs/specs/stowage-plan.md` (עודכן לאשדוד), ניסוי GO (הורץ שוב על אשדוד), תוכנית `docs/plans/stowage-plan-PLAN.md`. מסלול 3 נמלים לכל קו, נמל יעד לכל ייצוא, תוכנית מקומות שנבנית ב-Start work, העמסה לפי התוכנית (לא מעל מקום ריק), פריקה מלמעלה, מכולה מאוחרת מקבלת מקום פנוי (אזהרה אם שוברת חוק), עודף = short-shipped, מסך Stowage Plan. מספרים אקראיים קבועים (`rand()`). בדיקה עוברת |
| 4 | תרגול תכנון העמסה | לא התחיל | |
| 5 | מכולה מול ביקור של מכולה | לא התחיל | |
| 6 | לוח זמנים ורציף | לא התחיל | |
| 7 | רכבת | לא התחיל | |
| 8 | תיאום תורים למשאיות | לא התחיל | |
| 9 | הגדרת חוקי חצר | לא התחיל | |
| 10 | עיכובים והרשאות | לא התחיל | |
| 11 | קירור ומטען מסוכן | לא התחיל | |
| 12 | משתמשים ותפקידים | לא התחיל | |
| 13 | מסלולי וזמני נסיעה | לא התחיל | |
| 14 | תקלות ציוד ויעילות עגורנים | לא התחיל | |
| 15 | מטען המשך | לא התחיל | |
| 16 | הודעות בין מערכות (EDI) | לא התחיל | |
| 17 | חיוב מורחב | לא התחיל | |
| 18 | דוחות ומדדים | לא התחיל | |
| 19 | מצב הדרכה ותרגילים | לא התחיל | |
| 20 | תרחישים, ליטוש ואריזה | לא התחיל | |

## הצעד הבא
גרסה 4 (תרגול תכנון העמסה): מסמך דרישות ב-`docs/specs/stowage-practice.md`. הרעיון מהמפה: הלומד משבץ מכולה ביד, והמערכת מסמנת כל הפרת חוק ומסבירה למה. `ruleBreak()` ו-`slotReason()` מגרסה 3 הם הבסיס.

## מצב הקוד
- `index.html`: הסימולטור (TOS Trainer), קובץ אחד בלי תלויות. מצב נשמר ב-localStorage במפתח `tos-trainer-v1` (השם נשאר כדי למצוא שמירות ישנות). במצב יש `ver` (כרגע `STATE_VER = 2`). `load()` מריץ `normalize()`: צעד ב-`MIGRATE` לכל גרסה; שמירה שבורה או מגרסה לא מוכרת -> נמל חדש עם הודעה. **כשמשנים את מבנה הנתונים: להעלות `STATE_VER` ולהוסיף צעד ב-`MIGRATE`.**
  - תכנון העמסה: `ROUTES`, `SHIP`, `shipSlots`, `buildPlan` (ב-`startWork`), `lateSlot`, `ruleBreak`, `slotReason`, `unitAt`. לכל ביקור `plan` (מה מתוכנן) ו-`onboard` (מה פיזית על האונייה). ביקור עם `plan = null` (שמירה ישנה) עובד בסדר הישן. `rand()` = מספרים אקראיים קבועים שנשמרים במצב (`S.rng`). `STATE_VER = 3`.
  - לוח שנה: `isWorkTime`, `isGateOpen`, `nextGateOpen`, `storageDays`, `portState` (השעון = דקות אחרי חמישי 06:00, שעון נמל אחד בלי שעון קיץ). רציפים: `QUAYS`, `quayHolder`, `arrive()` מחזיר false כשהרציף תפוס. שער סגור: `gateClosed()`.
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
