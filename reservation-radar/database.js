const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'radar.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    neighborhood TEXT,
    cuisine TEXT,
    platform TEXT,
    booking_url TEXT,
    days_advance INTEGER,
    advance_notes TEXT,
    gluten_free INTEGER DEFAULT 0,
    gf_notes TEXT,
    my_notes TEXT,
    price_range TEXT,
    hot_level INTEGER DEFAULT 2,
    archived INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    target_date TEXT NOT NULL,
    party_size INTEGER DEFAULT 2,
    notes TEXT,
    status TEXT DEFAULT 'watching',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  );
`);

// Seed restaurant data
const count = db.prepare('SELECT COUNT(*) as c FROM restaurants').get();
if (count.c === 0) {
  const ins = db.prepare(`INSERT INTO restaurants
    (name, neighborhood, cuisine, platform, booking_url, days_advance, advance_notes, gluten_free, gf_notes, price_range, hot_level)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

  const restaurants = [
    // 🔥🔥🔥 Hardest to get
    ['Carbone', 'Greenwich Village', 'Italian-American', 'Resy', 'https://resy.com/cities/ny/carbone', 30, 'Opens exactly at midnight 30 days out — set an alarm. Goes within seconds.', 0, 'Limited GF options, kitchen can accommodate but pasta is the focus', '$$$$$', 3],
    ["Don Angie", 'West Village', 'Italian-American', 'Resy', 'https://resy.com/cities/ny/don-angie', 30, 'Opens midnight 30 days out. Extremely competitive — refreshing at midnight is the move.', 1, 'Good GF options, kitchen is accommodating', '$$$$$', 3],
    ['Lilia', 'Williamsburg', 'Italian', 'Resy', 'https://resy.com/cities/ny/lilia', 14, 'Drops Mondays at noon for the following 2 weeks. Refreshing all day Monday.', 0, 'Pasta-forward but has some GF options — worth calling ahead', '$$$$', 3],
    ['Torrisi', 'NoLita', 'Italian-American', 'Resy', 'https://resy.com/cities/ny/torrisi', 30, 'Opens midnight 30 days out. One of the toughest in the city.', 0, 'Limited accommodations — not ideal for strict GF', '$$$$$', 3],
    ["Rao's", 'East Harlem', 'Italian-American', 'Phone', '', 0, 'Effectively invite-only. Tables are "owned" by regulars. Worth trying anyway.', 0, 'Traditional red sauce — very limited GF', '$$$$$', 3],
    ['Le Bernardin', 'Midtown', 'French Seafood', 'OpenTable', 'https://www.opentable.com/le-bernardin', 30, 'Easier than most 3-stars. Check 30 days out. Bar seats easier.', 1, 'Excellent GF accommodations — seafood-forward menu, kitchen is meticulous', '$$$$$', 3],
    ['Atomix', 'Gramercy', 'Korean Fine Dining', 'Tock', 'https://www.exploretock.com/atomix', 60, 'Prepaid tickets release ~60 days out. Set a Tock alert.', 1, 'Tasting menu kitchen accommodates GF well — notify when booking', '$$$$$', 3],
    ['Polo Bar', 'Midtown', 'American', 'Resy', 'https://resy.com/cities/ny/polo-bar', 30, 'Opens midnight 30 days out. Scene-y and very tough.', 1, 'Classic American menu, kitchen accommodates GF', '$$$$$', 3],
    ['Jua', 'Flatiron', 'Korean', 'Resy', 'https://resy.com/cities/ny/jua', 30, 'Opens midnight 30 days out. Tiny restaurant, insanely hard.', 1, 'Tasting menu, kitchen accommodates GF — notify in advance', '$$$$$', 3],

    // 🔥🔥 Hard but possible
    ['Gramercy Tavern', 'Flatiron', 'American', 'Resy', 'https://resy.com/cities/ny/gramercy-tavern', 28, 'Opens ~28 days out. Tavern room (walk-in) is easier than main dining room.', 1, 'One of the best GF-friendly fine dining spots in NYC — kitchen is exceptionally accommodating', '$$$$', 2],
    ['Estela', 'NoLita', 'Mediterranean', 'Resy', 'https://resy.com/cities/ny/estela', 21, 'Releases weekly. Check Sundays for the following 3 weeks.', 1, 'Very GF friendly — many naturally GF dishes, staff knowledgeable', '$$$$', 2],
    ['Cote', 'Flatiron', 'Korean BBQ', 'Resy', 'https://resy.com/cities/ny/cote', 21, 'Releases weekly, check Monday mornings. Counter seats easier.', 1, 'Very GF friendly — KBBQ is naturally GF, great for the diet', '$$$$', 2],
    ['Frenchette', 'TriBeCa', 'French', 'Resy', 'https://resy.com/cities/ny/frenchette', 21, 'Opens 3 weeks out. Weekend brunch also very popular.', 1, 'Good GF options, staff aware and accommodating', '$$$$', 2],
    ['Le Coucou', 'SoHo', 'French', 'Resy', 'https://resy.com/cities/ny/le-coucou', 30, 'Opens midnight 30 days out. Less insane than Carbone but still tough.', 1, 'French cuisine accommodates GF well, notify when booking', '$$$$$', 2],
    ['Dirt Candy', 'Lower East Side', 'Vegetarian', 'Tock', 'https://www.exploretock.com/dirtcandy', 30, 'Prepaid tickets ~30 days out on Tock.', 1, 'Excellent GF options — creative vegetarian kitchen is very accommodating', '$$$$', 2],
    ['Oxomoco', 'Greenpoint', 'Mexican', 'Resy', 'https://resy.com/cities/ny/oxomoco', 14, 'Releases 2 weeks out. Weekend spots go fast.', 1, 'Very GF friendly — wood-fired Mexican, many naturally GF dishes', '$$$', 2],
    ['Scarpetta', 'Chelsea', 'Italian', 'OpenTable', 'https://www.opentable.com/scarpetta-restaurant-new-york', 21, 'OpenTable, 3 weeks out. More accessible than most.', 0, 'Pasta-focused but kitchen can accommodate GF — call ahead', '$$$$', 2],
    ['Momofuku Ko', 'East Village', 'American', 'Resy', 'https://resy.com/cities/ny/ko', 7, 'Counter seating only, drops daily at midnight for 7 days out.', 1, 'Kitchen accommodates GF for tasting menu — must notify when booking', '$$$$$', 2],
    ['Via Carota', 'West Village', 'Italian', 'Walk-in', '', 0, 'No reservations. Arrive at opening (5:30pm) or go late (after 9:30pm). Worth the wait.', 1, 'Many naturally GF Italian dishes — very accommodating', '$$$', 2],
    ['Lucali', 'Carroll Gardens', 'Pizza', 'Phone/Walk-in', '', 0, 'Call at 5pm when they open — first come first served. Bring wine. Worth it.', 0, 'Pizza = not GF. But they are the best. Up to you 😅', '$$$', 2],

    // ✨ GF Focused / Gems
    ['Senza Gluten', 'West Village', 'Italian (100% GF)', 'OpenTable', 'https://www.opentable.com/senza-gluten', 7, '100% gluten-free kitchen. Book 1-2 weeks out — not too hard.', 1, '100% dedicated gluten-free kitchen — total safe haven', '$$$', 1],
    ['Modern Bread and Bagel', 'Midtown West', 'Bakery/Cafe (100% GF)', 'Walk-in', '', 0, 'No reservations needed, walk in. 100% GF bakery.', 1, '100% dedicated GF facility — bagels, sandwiches, pastries', '$', 1],
    ['Shukette', 'Chelsea', 'Israeli/Mediterranean', 'Resy', 'https://resy.com/cities/ny/shukette', 14, 'Releases 2 weeks out. Lunch easier than dinner.', 1, 'Very GF friendly — Israeli food is naturally GF-forward', '$$$', 1],
    ['Superiority Burger', 'East Village', 'Vegetarian', 'Walk-in', '', 0, 'No reservations — small counter spot. Go early.', 1, 'Many GF options clearly marked on menu', '$', 1],
    ['Llama Inn', 'Williamsburg', 'Peruvian', 'Resy', 'https://resy.com/cities/ny/llama-inn', 14, '2 weeks out. Brunch is popular and harder than dinner.', 1, 'Peruvian cuisine is naturally very GF-friendly — corn-based dishes', '$$$', 1],
  ];

  restaurants.forEach(r => ins.run(...r));
}

module.exports = db;
