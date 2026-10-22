# HANDOFF - TOS Learning Lab (בסגנון Navis N4)

עודכן: 2026-10-22. נכתב בסוף סשן ענן שהתחיל בטעות בתוך ריפו DeckMix. **אין קשר בין הפרויקט הזה ל-DeckMix** (DeckMix הוא נגן DJ). שום קוד של DeckMix לא נגע בזה ולא בוצע שם commit.

## מטרה
מערכת לימוד שמדמה מערכת הפעלה למסוף מכולות (TOS) בהשראת Navis N4: דומה ביכולות וב"מראה" (סגנון שולחני קלאסי), כדי ש-Shalom ילמד איך מערכת כזו עובדת.

**הגבלות שנקבעו:**
- קוד מקורי בלבד. לא להעתיק קוד, נכסים או צילומי מסך מ-Navis/Kaleris או מכל TOS מסחרי.
- מסכי N4 האמיתיים לא ציבוריים, לכן המראה הוא "בסגנון N4" ולא העתק. להגיד את זה במפורש.
- Shalom אינו מתכנת: הסברים בעברית, מילים פשוטות, בלי ז'רגון.

## מה נמצא (מחקר ציבורי)
כל טענה מסומנת מאומתת במסמך המחקר המלא (ראה "קבצים"). בקצרה:

| נושא | ממצא |
|---|---|
| תחומים | ספינות, חצר, שער, רכבת, תורים/appointments, חיוב |
| מודולי אופטימיזציה | Expert Decking (תכנון חצר לפי חוקים), PrimeRoute (ניתוב רכבי חצר), Vessel Autostow, RTG Optimization |
| אוטומציה | N4 שולח משימות ל-ECS (מערכת בקרת ציוד). מעליו ASC Manager (מנופי ערימה) ו-AHT/AGV Manager |
| ארכיטקטורה | Java/J2EE, חוקים מונחי metadata, גרסת SaaS. Navis שייכת ל-Kaleris |
| מודל נתונים | **Unit** (זהות קבועה) נפרד מ-**Unit Facility Visit** (ביקור במסוף: מצב, מיקום, נשאים) |
| מצבי חיים | Advised -> Inbound -> EC/In -> Yard -> EC/Out -> Loaded -> Departed (מעל: Advised/Active/Departed) |
| Category | Domestic, Export, Import, Storage, Through, Transship |
| Carrier Visit | ספינה/רכבת/משאית. phases ידועים: Create, Working, Closed, Canceled, Archived |
| מיקום | block / row / tier, מיקום נוכחי ומתוכנן |
| Work Instruction | הוראה להזיז מכולה. מקובצות ב-Work Queues לכל Point of Work |
| הרחבה | שדות flex מותאמים וסקריפטי Groovy |

**לא נמצא ולא לנחש:** סכמת הטבלאות/העמודות המלאה, שמות enum מדויקים, קודי סוגי מהלך (DSCH/LOAD וכו' - לא אומתו), מבנה Holds ותעריפים, רשימת phase מלאה. דורש מסמכי Navis רשמיים.

## מה נעשה
1. מחקר ראשוני ומחקר עומק על מבנה הנתונים (מקורות ציבוריים בלבד, חלקם צד-שלישי כמו מצגות הדרכה ו-scribd).
2. נבנתה גרסה ראשונה של **TOS Learning Lab** כקובץ אחד `index.html` (HTML/JS, בלי תלויות): חצר עם 4 בלוקים (A-D) וערימות, Unit Inquiry, ספינות, שער, תורי עבודה (DISCHARGE/LOAD/GATE_IN/GATE_OUT), הקצאת ציוד (QC/AGV/ASC), rehandles שעולים כסף, חיוב (lift 150$ + אחסון 20$/יום אחרי 3 ימי חינם) ומסך "איך זה מתחבר ל-N4".
3. נבדק בדפדפן headless: רץ 12 שניות ב-x8, עברנו על כל 8 המסכים, **0 שגיאות קונסול**, 19 מהלכים בוצעו.
4. נמצאה ותוקנה תקלת עיצוב (כפתורי A-D כיסו כותרת). **התיקון לא נבדק מחדש** אחרי העריכה.
5. נוצר חיבור לסשן מקומי במחשב של Shalom (`shelpc22-sorted-pebble`, תיקייה `C:\Users\Shalom\Projects\TOS Navis N4`) ונשלחה אליו הוראת עבודה. אושר ש-Shalom הרשה לסשן הענן לשלוח הודעות למחשבים שלו.

## מה פתוח
- **הסשן המקומי תקוע** על בקשת אישור PowerShell (פקודת קריאה בלבד: `Get-ChildItem`, `git log`). עד שמאשרים הוא לא ימשיך. לא ידוע אם `index.html` כבר הועתק לתיקייה.
- **הפיצול החשוב ל-Lab:** כיום יחידה = ביקור אחד. צריך לפצל ל-Unit ו-UnitVisit ולהחליף מצב יחיד ב-visitState + transitState (7 שלבים). הצעת הסכמה בסעיף 9 במסמך המחקר. **טרם מומש.** Shalom עדיין לא אישר שזה הצעד הבא.
- לא מומשו: רכבת, appointments, תוכנית העמסה לספינה (Autostow), הגדרת חוקי decking, Holds, Damages לפי ביקור, תפקידים/משתמשים, ניתוב רכבי חצר.
- ההחלטה הלא-סגורה: כמה רחב לבנות (ליבה קטנה שעובדת - ברירת המחדל שבחרתי, כי Shalom לא ענה).
- הריפו `shalomeliy/TOS` היה ריק. ה-commit הזה הוא הראשון בו.

## קבצים וקוד חשובים
הקבצים הבאים **לא ב-git עדיין** (נוצרו בסקרצ'פד של סשן הענן, ונשלחו ל-Shalom כקבצים מצורפים):
- `index.html` - ה-Lab הראשון. מבנה: `init()` / `plan()` (יצירת WI) / `dispatch()` (הקצאת ציוד) / `advance()` / `complete()` / `bill()`, ומסכים ב-`VIEWS`. קבועים בראש: `BLOCKS`, `MAXTIER`, `TICKS_PER_DAY`, `FREE_DAYS`, `LIFT_FEE`, `STORAGE_FEE`.
- `N4-data-model-research.md` - מסמך מחקר מבנה הנתונים עם סימון [מאומת]/[הצעה], פערים ורשימת מקורות.

**לפעולה:** להעתיק את שני הקבצים לתיקייה `C:\Users\Shalom\Projects\TOS Navis N4` ולהוסיף אותם ל-git כאן.

## מקורות עיקריים
Kaleris Automation Product Sheet; Long Beach Container Terminal case study; porttechnology.org (N4 3.8); N4 3.6.34 Cargo Manual (scribd); Port Newark N4 User Guide; Biznovate N4 training deck (צד-שלישי); Fenix FCI API Specs 1.5.0; N4 Customization Guide - Groovy (n4.ptp.com.my); N4 Public APIs 4.0.6 (scribd, צד-שלישי); Navis crane automation API (collaboration.navis.com).

## הצעד הבא המומלץ
1. לאשר ב-PowerShell בסשן המקומי (או לפתוח סשן חדש בתיקייה).
2. להכניס את `index.html` ואת מסמך המחקר לתיקייה ול-git.
3. לממש את הפיצול Unit / UnitVisit ולבדוק בדפדפן.
