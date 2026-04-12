/*
-- CandyLife FiveM Bewerbungsformulare
-- Ausführen in Supabase SQL Editor

-- Support Team
UPDATE public.department_forms SET
  title = 'Support Team',
  intro = 'Willkommen bei der CandyLife Support-Bewerbung!\n\nBitte beantworte alle Fragen ehrlich und ausführlich. Unvollständige oder unleserliche Bewerbungen werden ohne Rückmeldung abgelehnt.\n\nWir wünschen dir viel Erfolg!',
  questions = '[
    {"id":"ingame_name","type":"text","label":"Wie lautet dein Ingame-Name?","required":true,"placeholder":"Vorname Nachname","section":"Persönliche Informationen"},
    {"id":"discord_name","type":"text","label":"Wie heißt du auf Discord?","required":true,"placeholder":"username","section":"Persönliche Informationen"},
    {"id":"age","type":"number","label":"Wie alt bist du?","required":true,"placeholder":"Dein Alter","section":"Persönliche Informationen"},
    {"id":"timezone","type":"text","label":"In welcher Zeitzone befindest du dich?","required":true,"placeholder":"z.B. UTC+1 (Deutschland)","section":"Persönliche Informationen"},
    {"id":"hours_per_week","type":"text","label":"Wie viele Stunden pro Woche kannst du aktiv sein?","required":true,"placeholder":"z.B. 10-15 Stunden","section":"Verfügbarkeit"},
    {"id":"active_times","type":"text","label":"Zu welchen Zeiten bist du meistens aktiv?","required":true,"placeholder":"z.B. Mo-Fr 18-22 Uhr, Wochenende tagsüber","section":"Verfügbarkeit"},
    {"id":"has_experience","type":"yesno","label":"Hast du bereits Erfahrung als Supporter oder in einem ähnlichen Bereich?","required":true,"section":"Erfahrung"},
    {"id":"experience_details","type":"textarea","label":"Falls ja – beschreibe deine Erfahrungen ausführlich.","required":false,"placeholder":"Server, Dauer, Aufgaben...","section":"Erfahrung"},
    {"id":"fivem_knowledge","type":"scale","label":"Wie gut kennst du dich mit FiveM aus? (1-10)","required":true,"section":"Kenntnisse"},
    {"id":"rp_knowledge","type":"scale","label":"Wie gut kennst du dich mit Roleplay-Regeln aus? (1-10)","required":true,"section":"Kenntnisse"},
    {"id":"motivation","type":"textarea","label":"Warum möchtest du dem CandyLife Support-Team beitreten?","required":true,"placeholder":"Deine Motivation ausführlich beschreiben...","section":"Motivation"},
    {"id":"strength","type":"textarea","label":"Was sind deine größten Stärken die du ins Team einbringst?","required":true,"placeholder":"Mindestens 3 Stärken nennen...","section":"Motivation"},
    {"id":"situation_1","type":"textarea","label":"Ein Spieler meldet ein Ticket und ist sehr aggressiv und beleidigend. Wie gehst du vor?","required":true,"placeholder":"Beschreibe dein genaues Vorgehen...","section":"Situationsfragen"},
    {"id":"situation_2","type":"textarea","label":"Zwei Spieler streiten sich und beide behaupten im Recht zu sein. Wie löst du den Konflikt?","required":true,"placeholder":"Deine Vorgehensweise...","section":"Situationsfragen"},
    {"id":"situation_3","type":"textarea","label":"Ein Spieler meldet einen Bug der das Spiel beeinflusst. Was tust du?","required":true,"placeholder":"Schritte beschreiben...","section":"Situationsfragen"},
    {"id":"rules_accepted","type":"yesno","label":"Hast du unsere Serverregeln gelesen und bist damit einverstanden?","required":true,"section":"Abschluss"},
    {"id":"extra","type":"textarea","label":"Möchtest du uns noch etwas mitteilen?","required":false,"placeholder":"Optional...","section":"Abschluss"}
  ]'
WHERE department = 'support';

-- Moderation Team
UPDATE public.department_forms SET
  title = 'Moderation Team',
  intro = 'Willkommen bei der CandyLife Moderations-Bewerbung!\n\nAls Moderator bist du für die Einhaltung der Serverregeln zuständig. Wir suchen erfahrene, ruhige und faire Persönlichkeiten.\n\nBitte beantworte alle Fragen wahrheitsgemäß.',
  questions = '[
    {"id":"ingame_name","type":"text","label":"Ingame-Name","required":true,"placeholder":"Vorname Nachname","section":"Persönliche Informationen"},
    {"id":"discord_name","type":"text","label":"Discord-Name","required":true,"placeholder":"username","section":"Persönliche Informationen"},
    {"id":"discord_id","type":"text","label":"Discord-ID","required":true,"placeholder":"123456789012345678","section":"Persönliche Informationen"},
    {"id":"age","type":"number","label":"Alter","required":true,"placeholder":"Dein Alter","section":"Persönliche Informationen"},
    {"id":"has_mod_experience","type":"yesno","label":"Hast du bereits Moderationserfahrung auf FiveM-Servern?","required":true,"section":"Erfahrung"},
    {"id":"mod_experience_details","type":"textarea","label":"Beschreibe deine bisherigen Moderationserfahrungen.","required":false,"placeholder":"Server, Dauer, Umfang...","section":"Erfahrung"},
    {"id":"fivem_knowledge","type":"scale","label":"FiveM-Kenntnisse (1-10)","required":true,"section":"Kenntnisse"},
    {"id":"rule_knowledge","type":"scale","label":"Regelwerk-Kenntnisse (1-10)","required":true,"section":"Kenntnisse"},
    {"id":"hours_per_week","type":"text","label":"Verfügbare Stunden pro Woche","required":true,"placeholder":"z.B. 15-20 Stunden","section":"Verfügbarkeit"},
    {"id":"motivation","type":"textarea","label":"Warum möchtest du Moderator bei CandyLife werden?","required":true,"placeholder":"Ausführliche Begründung...","section":"Motivation"},
    {"id":"situation_1","type":"textarea","label":"Du siehst wie ein Spieler Regeln bricht aber dir fehlen Beweise. Wie gehst du vor?","required":true,"placeholder":"Exaktes Vorgehen beschreiben...","section":"Situationsfragen"},
    {"id":"situation_2","type":"textarea","label":"Ein bekannter Spieler meldet einen anderen wegen Regelverstoß. Du magst den Melder nicht. Wie handelst du?","required":true,"placeholder":"Dein Vorgehen...","section":"Situationsfragen"},
    {"id":"situation_3","type":"textarea","label":"Ein Spieler beschwert sich über eine Strafe die du gegeben hast. Was tust du?","required":true,"placeholder":"Beschreibe dein Verhalten...","section":"Situationsfragen"},
    {"id":"situation_4","type":"textarea","label":"Du bemerkst dass ein Kollege einen Regelverstoß begeht. Wie reagierst du?","required":true,"placeholder":"Deine Reaktion...","section":"Situationsfragen"},
    {"id":"microphone","type":"yesno","label":"Hast du ein funktionierendes Mikrofon?","required":true,"section":"Technisches"},
    {"id":"rules_accepted","type":"yesno","label":"Ich habe die Serverregeln gelesen und akzeptiere diese.","required":true,"section":"Abschluss"},
    {"id":"extra","type":"textarea","label":"Sonstige Anmerkungen","required":false,"placeholder":"Optional...","section":"Abschluss"}
  ]'
WHERE department = 'moderation';

-- Administration Team
UPDATE public.department_forms SET
  title = 'Administration Team',
  intro = 'Willkommen bei der CandyLife Administrations-Bewerbung!\n\nDie Administration ist für schwerwiegendere Sanktionen und die Serverorganisation zuständig. Wir erwarten Erfahrung, Reife und Verantwortungsbewusstsein.',
  questions = '[
    {"id":"ingame_name","type":"text","label":"Ingame-Name","required":true,"placeholder":"Vorname Nachname","section":"Persönliche Informationen"},
    {"id":"discord_name","type":"text","label":"Discord-Name & ID","required":true,"placeholder":"username | 123456789","section":"Persönliche Informationen"},
    {"id":"age","type":"number","label":"Alter","required":true,"placeholder":"Dein Alter","section":"Persönliche Informationen"},
    {"id":"current_rank","type":"text","label":"Aktueller Rang auf CandyLife","required":true,"placeholder":"z.B. Moderator","section":"Persönliche Informationen"},
    {"id":"time_on_server","type":"text","label":"Wie lange bist du bereits auf CandyLife?","required":true,"placeholder":"z.B. 6 Monate","section":"Erfahrung"},
    {"id":"admin_experience","type":"yesno","label":"Hast du bereits Admin-Erfahrung auf anderen Servern?","required":true,"section":"Erfahrung"},
    {"id":"admin_experience_details","type":"textarea","label":"Beschreibe deine Admin-Erfahrungen.","required":false,"placeholder":"Ausführlich beschreiben...","section":"Erfahrung"},
    {"id":"motivation","type":"textarea","label":"Warum möchtest du Administrator werden?","required":true,"placeholder":"Ausführliche Begründung...","section":"Motivation"},
    {"id":"improvement","type":"textarea","label":"Was würdest du am Server verbessern?","required":true,"placeholder":"Konkrete Vorschläge...","section":"Motivation"},
    {"id":"situation_1","type":"textarea","label":"Ein Spieler wurde permanent gebannt und beschwert sich aggressiv im Discord. Wie reagierst du?","required":true,"placeholder":"Dein Vorgehen...","section":"Situationsfragen"},
    {"id":"situation_2","type":"textarea","label":"Du findest heraus dass ein Moderator seinen Rang missbraucht. Was tust du?","required":true,"placeholder":"Beschreibe jeden Schritt...","section":"Situationsfragen"},
    {"id":"situation_3","type":"textarea","label":"Ein großer Streamer kommt auf den Server und bricht Regeln. Wie gehst du damit um?","required":true,"placeholder":"Faire Behandlung erklären...","section":"Situationsfragen"},
    {"id":"hours_per_week","type":"text","label":"Wöchentliche Verfügbarkeit","required":true,"placeholder":"z.B. 20+ Stunden","section":"Verfügbarkeit"},
    {"id":"rules_accepted","type":"yesno","label":"Ich akzeptiere alle CandyLife-Richtlinien für Administratoren.","required":true,"section":"Abschluss"},
    {"id":"extra","type":"textarea","label":"Weitere Informationen","required":false,"placeholder":"Optional...","section":"Abschluss"}
  ]'
WHERE department = 'administration';

-- Development Team
UPDATE public.department_forms SET
  title = 'Development Team',
  intro = 'Willkommen bei der CandyLife Development-Bewerbung!\n\nWir suchen talentierte Entwickler die unser FiveM-Projekt voranbringen möchten. Zeige uns deine Fähigkeiten!',
  questions = '[
    {"id":"ingame_name","type":"text","label":"Ingame-Name","required":true,"placeholder":"Vorname Nachname","section":"Persönliche Informationen"},
    {"id":"discord_name","type":"text","label":"Discord-Name & ID","required":true,"placeholder":"username | 123456789","section":"Persönliche Informationen"},
    {"id":"age","type":"number","label":"Alter","required":true,"placeholder":"Dein Alter","section":"Persönliche Informationen"},
    {"id":"dev_area","type":"select","label":"In welchem Bereich möchtest du dich bewerben?","required":true,"options":["Lua/FiveM Scripting","Web Development","UI/UX Design","3D Modelling","Mapping","Andere"],"section":"Spezialisierung"},
    {"id":"languages","type":"textarea","label":"Welche Programmiersprachen/Tools beherrschst du?","required":true,"placeholder":"z.B. Lua, JavaScript, React, Blender...","section":"Kenntnisse"},
    {"id":"experience_years","type":"text","label":"Seit wie vielen Jahren bist du im Development tätig?","required":true,"placeholder":"z.B. 3 Jahre","section":"Kenntnisse"},
    {"id":"fivem_experience","type":"yesno","label":"Hast du bereits Erfahrung mit FiveM-Scripting?","required":true,"section":"FiveM Kenntnisse"},
    {"id":"fivem_experience_details","type":"textarea","label":"Beschreibe deine FiveM-Erfahrungen.","required":false,"placeholder":"Ressourcen, Frameworks (ESX, QBCore, ox_core)...","section":"FiveM Kenntnisse"},
    {"id":"portfolio","type":"text","label":"Portfolio / GitHub / Beispiele","required":false,"placeholder":"https://... oder github.com/...","section":"Portfolio"},
    {"id":"previous_work","type":"textarea","label":"Beschreibe deine bisher wichtigsten Projekte.","required":true,"placeholder":"Was hast du entwickelt? Für wen?","section":"Portfolio"},
    {"id":"motivation","type":"textarea","label":"Warum möchtest du bei CandyLife entwickeln?","required":true,"placeholder":"Deine Motivation...","section":"Motivation"},
    {"id":"time_commitment","type":"text","label":"Wie viel Zeit kannst du pro Woche investieren?","required":true,"placeholder":"z.B. 10-20 Stunden","section":"Verfügbarkeit"},
    {"id":"works_in_team","type":"yesno","label":"Kannst du in einem Team arbeiten und Feedback annehmen?","required":true,"section":"Soft Skills"},
    {"id":"rules_accepted","type":"yesno","label":"Ich akzeptiere die CandyLife-Richtlinien für Entwickler.","required":true,"section":"Abschluss"},
    {"id":"extra","type":"textarea","label":"Weitere Informationen","required":false,"placeholder":"Optional...","section":"Abschluss"}
  ]'
WHERE department = 'development';

-- Fraktionsmanagement
UPDATE public.department_forms SET
  title = 'Fraktionsmanagement',
  intro = 'Willkommen bei der CandyLife Fraktionsmanagement-Bewerbung!\n\nDas Fraktionsmanagement kümmert sich um die Verwaltung und Betreuung aller Fraktionen auf dem Server.',
  questions = '[
    {"id":"ingame_name","type":"text","label":"Ingame-Name","required":true,"placeholder":"Vorname Nachname","section":"Persönliche Informationen"},
    {"id":"discord_name","type":"text","label":"Discord-Name & ID","required":true,"placeholder":"username | 123456789","section":"Persönliche Informationen"},
    {"id":"age","type":"number","label":"Alter","required":true,"placeholder":"Dein Alter","section":"Persönliche Informationen"},
    {"id":"current_rank","type":"text","label":"Aktueller Rang auf CandyLife","required":true,"placeholder":"z.B. Administrator","section":"Persönliche Informationen"},
    {"id":"main_faction","type":"text","label":"In welcher Fraktion bist du hauptsächlich aktiv?","required":true,"placeholder":"z.B. LSPD, Krankenhaus...","section":"Erfahrung"},
    {"id":"faction_experience","type":"textarea","label":"Beschreibe deine Erfahrungen mit Fraktionen auf FiveM.","required":true,"placeholder":"Welche Fraktionen? Welche Rolle? Wie lange?","section":"Erfahrung"},
    {"id":"motivation","type":"textarea","label":"Warum möchtest du ins Fraktionsmanagement?","required":true,"placeholder":"Ausführliche Begründung...","section":"Motivation"},
    {"id":"improvement","type":"textarea","label":"Was würdest du am Fraktionssystem verbessern?","required":true,"placeholder":"Konkrete Ideen...","section":"Motivation"},
    {"id":"situation_1","type":"textarea","label":"Eine Fraktion meldet massive interne Probleme. Wie gehst du vor?","required":true,"placeholder":"Schritte beschreiben...","section":"Situationsfragen"},
    {"id":"situation_2","type":"textarea","label":"Zwei Fraktionen haben anhaltende Konflikte. Wie vermittelst du?","required":true,"placeholder":"Deine Vorgehensweise...","section":"Situationsfragen"},
    {"id":"hours_per_week","type":"text","label":"Wöchentliche Verfügbarkeit","required":true,"placeholder":"z.B. 15-25 Stunden","section":"Verfügbarkeit"},
    {"id":"rules_accepted","type":"yesno","label":"Ich akzeptiere alle CandyLife-Richtlinien.","required":true,"section":"Abschluss"},
    {"id":"extra","type":"textarea","label":"Weitere Informationen","required":false,"placeholder":"Optional...","section":"Abschluss"}
  ]'
WHERE department = 'fraktionsmanagement';
*/