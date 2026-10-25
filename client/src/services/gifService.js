/**
 * GIF Service supporting GIPHY / Tenor REST API with offline/fallback curated dataset.
 * Designed for WhatsApp-like GIF search and trending browsing.
 */

// Curated Category Chips
export const GIF_CATEGORIES = [
  { id: 'trending', label: '🔥 Trending' },
  { id: 'reactions', label: '😂 Reactions' },
  { id: 'love', label: '❤️ Love' },
  { id: 'happy', label: '🥳 Happy' },
  { id: 'laugh', label: '🤣 Laugh' },
  { id: 'sad', label: '😭 Sad' },
  { id: 'dance', label: '💃 Dance' },
  { id: 'confused', label: '🤔 Confused' },
  { id: 'yes', label: '👍 Yes / Agree' },
  { id: 'no', label: '👎 No / Disagree' },
  { id: 'wow', label: '✨ Wow / Shock' },
  { id: 'party', label: '🎉 Party' },
  { id: 'memes', label: '🐸 Memes' }
];

// Curated Offline Dataset with reliable direct CDN links
export const CURATED_GIFS = [
  // Trending
  {
    id: 'tr_1',
    title: 'Thumbs Up Excited',
    category: 'trending',
    tags: ['trending', 'yes', 'thumbs up', 'happy', 'cool', 'nice'],
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'tr_2',
    title: 'Cat Vibing Jamming',
    category: 'trending',
    tags: ['trending', 'cat', 'vibing', 'music', 'dance', 'bobbing', 'cool'],
    url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'tr_3',
    title: 'Popcorn Eating Drama',
    category: 'trending',
    tags: ['trending', 'popcorn', 'watching', 'drama', 'movie', 'eating'],
    url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'tr_4',
    title: 'Celebration Confetti',
    category: 'trending',
    tags: ['trending', 'celebrate', 'party', 'confetti', 'yay', 'winner'],
    url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/g9582DNuQppxC/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'tr_5',
    title: 'Applause Clapping',
    category: 'trending',
    tags: ['trending', 'clap', 'applause', 'bravo', 'congrats', 'respect'],
    url: 'https://media.giphy.com/media/ely3apij36BJhoZ234/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/ely3apij36BJhoZ234/200w.gif',
    width: 320,
    height: 240
  },

  // Reactions & Laugh
  {
    id: 'rx_1',
    title: 'Leonardo DiCaprio Cheers',
    category: 'reactions',
    tags: ['reactions', 'cheers', 'drink', 'toast', 'gatsby', 'laugh', 'classy'],
    url: 'https://media.giphy.com/media/GCLlQnV7dXY2KGmpRh/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/GCLlQnV7dXY2KGmpRh/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'rx_2',
    title: 'Kanye West Smile then Serious',
    category: 'reactions',
    tags: ['reactions', 'smile', 'serious', 'mood', 'funny', 'awkward'],
    url: 'https://media.giphy.com/media/14smAwp2uJKx3i/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/14smAwp2uJKx3i/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'rx_3',
    title: 'Minion Laughing Hysterically',
    category: 'laugh',
    tags: ['laugh', 'minions', 'funny', 'haha', 'rofl', 'lol', 'giggle'],
    url: 'https://media.giphy.com/media/MOWPkhJx7MzxS/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/MOWPkhJx7MzxS/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'rx_4',
    title: 'Friends Laughing Joey Chandler',
    category: 'laugh',
    tags: ['laugh', 'friends', 'joey', 'chandler', 'haha', 'lol'],
    url: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'rx_5',
    title: 'Ryan Reynolds Facepalm',
    category: 'reactions',
    tags: ['reactions', 'facepalm', 'smh', 'ryan reynolds', 'disappointed', 'sigh'],
    url: 'https://media.giphy.com/media/3oEjI67Egb8G9jNUGI/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3oEjI67Egb8G9jNUGI/200w.gif',
    width: 300,
    height: 200
  },

  // Love & Affection
  {
    id: 'lv_1',
    title: 'Blowing Kiss Hearts',
    category: 'love',
    tags: ['love', 'kiss', 'hearts', 'romance', 'cute', 'hug'],
    url: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'lv_2',
    title: 'Cute Puppy Heart Eyes',
    category: 'love',
    tags: ['love', 'dog', 'puppy', 'cute', 'adore', 'heart'],
    url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'lv_3',
    title: 'Warm Hug Embrace',
    category: 'love',
    tags: ['love', 'hug', 'embrace', 'comfort', 'friends', 'sweet'],
    url: 'https://media.giphy.com/media/3M4NpbLCTxBqU/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3M4NpbLCTxBqU/200w.gif',
    width: 320,
    height: 240
  },

  // Happy & Party
  {
    id: 'hp_1',
    title: 'Happy Snoopy Dance',
    category: 'happy',
    tags: ['happy', 'dance', 'snoopy', 'joy', 'celebrate', 'excited'],
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'hp_2',
    title: 'Carlton Dance Celebration',
    category: 'dance',
    tags: ['dance', 'carlton', 'fresh prince', 'party', 'happy', 'funny'],
    url: 'https://media.giphy.com/media/pa37AAGzKXoek/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/pa37AAGzKXoek/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'hp_3',
    title: 'The Office Disco Dancing',
    category: 'dance',
    tags: ['dance', 'the office', 'michael scott', 'party', 'disco'],
    url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/200w.gif',
    width: 320,
    height: 240
  },

  // Sad & Crying
  {
    id: 'sd_1',
    title: 'Crying Rain Dramatic',
    category: 'sad',
    tags: ['sad', 'cry', 'crying', 'tears', 'rain', 'depressed', 'drama'],
    url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/OPU6wzx8JrHna/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'sd_2',
    title: 'Cat Crying Sad Eyes',
    category: 'sad',
    tags: ['sad', 'cat', 'cry', 'hurt', 'heartbroken', 'sorrow'],
    url: 'https://media.giphy.com/media/7SF5scGB2AFrgsXP63/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/7SF5scGB2AFrgsXP63/200w.gif',
    width: 300,
    height: 200
  },

  // Confused & Shocked
  {
    id: 'cf_1',
    title: 'Confused John Travolta Pulp Fiction',
    category: 'confused',
    tags: ['confused', 'where', 'lost', 'what', 'john travolta', 'huh'],
    url: 'https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'cf_2',
    title: 'Math Lady Calculating Meme',
    category: 'confused',
    tags: ['confused', 'math', 'calculating', 'thinking', 'puzzled', 'meme'],
    url: 'https://media.giphy.com/media/4JVTF9fR99WYo/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/4JVTF9fR99WYo/200w.gif',
    width: 300,
    height: 200
  },
  {
    id: 'cf_3',
    title: 'Shocked Cat Gasp',
    category: 'wow',
    tags: ['wow', 'shocked', 'cat', 'omg', 'gasp', 'surprised'],
    url: 'https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/200w.gif',
    width: 300,
    height: 200
  },

  // Yes & Agree
  {
    id: 'ys_1',
    title: 'Nodding Yes Robert Redford',
    category: 'yes',
    tags: ['yes', 'nod', 'agree', 'satisfied', 'approval', 'good'],
    url: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'ys_2',
    title: 'Hell Yeah Rock On',
    category: 'yes',
    tags: ['yes', 'rock', 'excited', 'agree', 'hell yeah'],
    url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200w.gif',
    width: 320,
    height: 240
  },

  // No & Disagree
  {
    id: 'no_1',
    title: 'Steve Carell Michael Scott NO GOD PLEASE NO',
    category: 'no',
    tags: ['no', 'michael scott', 'the office', 'disagree', 'never', 'refuse'],
    url: 'https://media.giphy.com/media/vyTnNTrs3wqQ0UIvwE/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/vyTnNTrs3wqQ0UIvwE/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'no_2',
    title: 'Mutombo Finger Wag No',
    category: 'no',
    tags: ['no', 'finger wag', 'nope', 'not today', 'reject'],
    url: 'https://media.giphy.com/media/11ai694Li10GiA/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/11ai694Li10GiA/200w.gif',
    width: 300,
    height: 200
  },

  // Memes
  {
    id: 'mm_1',
    title: 'Doge Wow Such Cool',
    category: 'memes',
    tags: ['memes', 'doge', 'dog', 'shiba', 'such wow', 'cute'],
    url: 'https://media.giphy.com/media/oBQZsgHlWVjBQ4CXW2/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/oBQZsgHlWVjBQ4CXW2/200w.gif',
    width: 320,
    height: 240
  },
  {
    id: 'mm_2',
    title: 'Pepe Cheers Drink',
    category: 'memes',
    tags: ['memes', 'pepe', 'frog', 'cheers', 'drink', 'classic'],
    url: 'https://media.giphy.com/media/BEob5NyPxNg4/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/BEob5NyPxNg4/200w.gif',
    width: 300,
    height: 200
  }
];

// In-memory cache for API queries
const gifCache = new Map();

/**
 * Fetch GIFs from GIPHY REST API, with fallback to curated dataset
 */
export const fetchGifs = async ({ query = '', category = 'trending', limit = 20 } = {}) => {
  const cacheKey = `${query}_${category}_${limit}`;
  if (gifCache.has(cacheKey)) {
    return gifCache.get(cacheKey);
  }

  // First try GIPHY Public Beta API Key if available
  const giphyKey = import.meta.env?.VITE_GIPHY_API_KEY || 'sXpGFDGZs0Dv1qTvvoTueQKmflsmOHAb';
  const searchTerm = query ? query.trim() : (category !== 'trending' ? category : '');

  try {
    const endpoint = searchTerm 
      ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(searchTerm)}&limit=${limit}&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyKey}&limit=${limit}&rating=g`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json?.data && json.data.length > 0) {
        const formatted = json.data.map(item => ({
          id: item.id,
          title: item.title || 'Animated GIF',
          url: item.images?.original?.url || item.images?.downsized?.url || item.images?.fixed_height?.url,
          previewUrl: item.images?.fixed_height_small?.url || item.images?.downsized?.url || item.images?.original?.url,
          width: parseInt(item.images?.fixed_height?.width || '200', 10),
          height: parseInt(item.images?.fixed_height?.height || '150', 10)
        })).filter(g => Boolean(g.url));

        if (formatted.length > 0) {
          gifCache.set(cacheKey, formatted);
          return formatted;
        }
      }
    }
  } catch (err) {
    // API failed, timed out, or blocked: smoothly fallback to curated local dataset
    // console.info('GIF API unavailable, using curated dataset:', err.message);
  }

  // Local Curated Fallback Search
  const results = filterCuratedGifs(query, category);
  gifCache.set(cacheKey, results);
  return results;
};

/**
 * Filter curated GIFs based on query or category
 */
export const filterCuratedGifs = (query = '', category = 'trending') => {
  const clean = query.toLowerCase().trim();

  if (!clean) {
    if (!category || category === 'trending') return CURATED_GIFS;
    return CURATED_GIFS.filter(g => g.category === category || g.tags.includes(category));
  }

  // Search by query
  return CURATED_GIFS.filter(g => {
    return (
      g.title.toLowerCase().includes(clean) ||
      g.category.toLowerCase().includes(clean) ||
      g.tags.some(t => t.includes(clean))
    );
  });
};
