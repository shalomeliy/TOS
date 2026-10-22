# מבנה הנתונים של Navis N4 - מחקר (22/10/2026)

**אזהרה ראשונה:** הסכמה המלאה של N4 (כל הטבלאות והעמודות) לא פורסמה בציבור. היא נמצאת במסמכי Navis לרישיון בלבד. כל מה שמסומן **[מאומת]** נמצא במקור ציבורי שמצוין. מה שמסומן **[הצעה]** הוא תכנון שלי ל-Lab, מבוסס על המושגים המאומתים, ולא העתק של N4.

## 1. העקרון המרכזי: Unit מול Unit Facility Visit (UFV)  [מאומת]

N4 מפריד בין "המכולה כחפץ" לבין "הביקור שלה במסוף":

| ישות | מה היא מחזיקה |
|---|---|
| **Unit** | הזהות הקבועה: מספר מכולה, סוג/גודל, קו (line operator), משקל, אטמים |
| **Unit Facility Visit (UFV)** | הביקור במסוף מסוים: מצב, מיקום, ספינה נכנסת/יוצאת, זמנים |
| **Damages** | נשמרים **לכל ביקור בנפרד** (מקור: מדריך N4 Cargo) |

מכולה שחוזרת למסוף אחרי חודשים: אותו Unit, UFV חדש. זה ההבדל הגדול ממה שבניתי ב-Lab עכשיו (שם יחידה = ביקור אחד).

באג ידוע שממחיש את זה: כשמכולת יצוא מקבלת גם release וגם loadlist, N4 יצר UFV שני במקום לעדכן את הקיים.

## 2. מצבי חיים  [מאומת, ממצגת הדרכה צד-שלישי]

שתי רמות:

- **Visit state:** Advised, Active, Departed (ובמקורות אחרים: Retired = סוף חיי הביקור).
- **Transit state (עדין יותר, בתוך Active):**

```
1-Advised -> 2-Inbound -> 3-EC/In -> 4-Yard -> 5-EC/Out -> 6-Loaded -> 7-Departed
```

| מצב | משמעות |
|---|---|
| Advised | צפוי להגיע, לא בטוח |
| Inbound | בדרך (על ספינה/משאית/רכבת נכנסת) |
| EC/In | התקבל או פורק, עדיין לא הונח במיקום חצר |
| Yard | נמצא במיקום חצר ספציפי |
| EC/Out | בדרך החוצה: נוצרה הוראת עבודה |
| Loaded | הועמס על נשא יוצא |
| Departed | עזב על נשא יוצא |

הערה: שמות ה-enum המדויקים בקוד לא אומתו (השם `UfvTransitState` לא נמצא באף מקור).

## 3. Category ו-Freight kind  [מאומת]

- **Category** (ייעוד משפטי): Domestic, Export, Import, Storage, Through, Transship.
- **Freight kind:** מצב המטען (למשל מלא/ריק). ב-Unit Inspector מוצגים: transit state, position, last move, freight kind, line operator.

## 4. Carrier Visit  [חלקית מאומת]

כל נשא הוא "ביקור נשא": ספינה, רכבת, משאית. ליחידה יש שני קישורים:

- **Declared outbound CV** (`UNIT_DECLARED_OB_CV`): לאן התכוונו לשלוח אותה.
- **Actual inbound/outbound CV** (`UFV_ACTUAL_IB_CV` / `UFV_ACTUAL_OB_CV`): איך הגיעה בפועל / איך יצאה.

שלבי חיים (phase) שאומתו בשמם: Create, Working, Closed, Canceled, Archived (רשימה מלאה לא נמצאה). כללים מאומתים:
- ביקורי Create/Canceled/Closed/Archived לא נראים בפעולות רגילות.
- פריקה מרכבת דורשת שהרכבת תהיה ב-Working.
- N4 לא מעבד discharge list לספינה ב-Archived.

## 5. מיקום (Position)  [חלקית מאומת]

- היחידה מחזיקה **current position**, **planned position** ופרטי slot: Block / Row / Tier.
- בפריקה חובה להזין Yard Position תקף.
- בטבלאות המסד נראה הקישור: `inv_unit_fcy_visit` מצביעה על `inv_unit` ועל `argo_carrier_visit` (מקטע SQL ציבורי ממדריך EDI 3.8.6). שמות העמודות המלאים לא פורסמו.

## 6. הוראות עבודה (Work Instruction) ותורי עבודה  [חלקית מאומת]

- WI = הוראה להזיז מכולה ממיקום למיקום. N4 שולח הודעות כשה-WI נוספת, מוסרת, או משתנה בסדר (מקור: Navis crane automation API).
- WI מקובצות ב-**Work Queues** לכל **Point of Work**. הסדר בתור קובע איך נשלחים רכבי חצר ומנופים.
- אוטומציה: ה-TOS שולח ל-ECS, שמפעיל מנופים ו-AGV.
- קודי סוג-מהלך (DSCH, LOAD ועוד): **לא אומתו** בשום מקור שמצאתי. אל תסמוך עליהם.

## 7. חיוב  [מאומת ברמה גבוהה בלבד]

N4 Billing: חשבוניות, תשלומים, זיכויים. האירועים והתעריפים מוגדרים בנתונים (לא בקוד). פרטי הסכמה לא פורסמו.

## 8. הרחבה בלי לגעת בליבה  [מאומת]

- **Dynamic flex fields:** שדות מותאמים על ישויות (Unit וכו'), מגיעים דרך UFV.
- **Groovy code extensions:** סקריפטים שרצים על ישויות (Unit, UnitFacilityVisit, WorkInstruction), גם דרך REST.
- זה העיקרון "מונחה metadata" שהוזכר במחקר הראשון.

## 9. הצעה לסכמה של ה-Lab  [הצעה - לא העתק של N4]

מבוסס רק על המושגים שלמעלה:

```
Unit            { id, line, type, size, weight, seals[], flex{} }
UnitVisit (UFV) { id, unitId, visitState, transitState, category, freightKind,
                  obCarrierDeclared, ibCarrierActual, obCarrierActual,
                  position{block,row,col,tier}, plannedPosition, createdAt, departedAt }
CarrierVisit    { id, mode(vessel|rail|truck), phase, eta, etd }
WorkInstruction { id, ufvId, fromPos, toPos, queueId, sequence, state, equipmentId }
WorkQueue       { id, pointOfWork, wiIds[] }
Equipment       { id, type(QC|AGV|ASC|RTG|TRUCK), state, jobId }
Hold            { id, unitId, type, active }
Damage          { id, ufvId, desc }   // per visit, like N4
ChargeEvent     { id, ufvId, serviceCode, qty }
Invoice         { id, lines[], total, status }
```

**השינוי הכי חשוב בהשוואה לגרסה הראשונה של ה-Lab:** לפצל Unit ו-UnitVisit, ולהחליף את מצב היחידה היחיד ב-visitState + transitState (7 השלבים).

## פערים - מה לא נמצא
1. הסכמה המלאה (עמודות) ושמות ה-enum המדויקים.
2. קודי סוג-מהלך של WI.
3. מבנה ה-Hold/Permission והתעריפים.
4. רשימת ה-phase המלאה של Carrier Visit.
כדי לסגור אותם צריך מסמכי Navis בלי NDA (Javadoc / Customization Guide) או מישהו עם גישה רשמית. אל תנחש.

## מקורות
- N4 3.6.34 Cargo Manual (scribd)
- Navis SPARCS N4 2.3.2 Release Notes (namport.com.na)
- Port Newark Container Terminal N4 User Guide (pnct.net)
- Biznovate SPARCS N4 & XPS 5-day training deck (biznovatetech.com, צד-שלישי)
- Fenix Commercial Interface FCI API Specs 1.5.0 (fenixmarineservices.com)
- N4 Customization Guide: Groovy plug-ins (n4.ptp.com.my)
- Navis N4 Public APIs Overview 4.0.6 (scribd, צד-שלישי)
- How to Use the N4 Crane Automation System API (collaboration.navis.com)
- Navis N4: EDI, Billing, and Services Management (pdfcoffee.com, צד-שלישי)
