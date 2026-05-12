export type Role = 'super_admin' | 'admin' | 'member'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  branch: string
  avatar: string
  joinedAt: string
  totalContributed: number
  isHeadOfFamily?: boolean
  phone?: string
  address?: string
  dob?: string
  profilePhoto?: string
  familyMembers?: { name: string; relationship: string }[]
}

export interface MediaItem {
  type: 'image' | 'video'
  url: string
  caption?: string
}

export interface Announcement {
  id: string
  title: string
  content: string       // plain text summary
  htmlContent?: string  // rich-text HTML from TipTap
  media: MediaItem[]
  authorId: string
  authorName: string
  createdAt: string
  isPinned: boolean
  likedBy: string[]
  comments: Comment[]
}

export interface Comment {
  id: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

export interface Event {
  id: string
  title: string
  description: string   // plain text
  htmlContent?: string  // rich text HTML
  media: MediaItem[]
  date: string
  time: string
  location: string
  createdBy: string
  rsvps: RSVP[]
}

export interface RSVP {
  userId: string
  userName: string
  status: 'attending' | 'not_attending' | 'maybe'
}

export interface MarketplaceListing {
  id: string
  sellerId: string
  sellerName: string
  title: string
  description: string
  htmlDescription?: string
  price: string
  category: 'sale' | 'service' | 'request'
  createdAt: string
  expiresAt: string
  photos?: string[]
  readBy?: string[]
}

export interface Expense {
  id: string
  description: string
  amount: number
  date: string
  category: 'event' | 'admin' | 'charity' | 'other'
}

export interface ContributionDrive {
  id: string
  title: string
  description: string
  amountType: 'fixed' | 'flexible'
  fixedAmount?: number
  minimumAmount?: number
  targetAmount: number
  payNowName: string
  payNowNumber: string
  deadline: string
  specialInstructions?: string
  status: 'active' | 'closed'
  hofOnly?: boolean
  expenses: Expense[]
  contributions: Contribution[]
}

export interface Contribution {
  id: string
  userId: string
  userName: string
  amount: number
  paidAt: string
  confirmed: boolean
  confirmedBy?: string
}

export interface ExcoMember {
  id: string
  userId: string
  name: string
  position: string
  avatar: string
  since?: string
}

export interface GroupChat {
  id: string
  name: string
  platform: 'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'x' | 'other'
  url: string
  description: string
  sortOrder: number
}

export interface FeedbackItem {
  id: string
  userId: string
  userName: string
  content: string
  contactDetails: string
  requestFollowUp: boolean
  status: 'open' | 'resolved'
  createdAt: string
  lastActionBy?: string
  lastActionAt?: string
  lastAction?: 'resolved' | 'reopened'
}

// ─── Mock Users ───────────────────────────────────────────────────────────────
export const MOCK_USERS: User[] = [
  {
    id: 'u0',
    name: 'Qhairul Asmai',
    email: 'qhairul.asmai@gmail.com',
    role: 'super_admin',
    branch: 'Cawangan Utama',
    avatar: 'QA',
    joinedAt: '2026-05-11',
    totalContributed: 0,
  },
  {
    id: 'u1',
    name: 'Ahmad Razif Mat Indra',
    email: 'superadmin@kbmi.com',
    role: 'super_admin',
    branch: 'Cawangan Utama',
    avatar: 'AR',
    joinedAt: '2024-01-01',
    totalContributed: 500,
  },
  {
    id: 'u2',
    name: 'Siti Hajar Bte Yusof',
    email: 'admin@kbmi.com',
    role: 'admin',
    branch: 'Cawangan Johor',
    avatar: 'SH',
    joinedAt: '2024-01-15',
    totalContributed: 350,
  },
  {
    id: 'u3',
    name: 'Farid Bin Hashim',
    email: 'member@kbmi.com',
    role: 'member',
    branch: 'Cawangan Tampines',
    avatar: 'FH',
    joinedAt: '2024-02-01',
    totalContributed: 200,
  },
  {
    id: 'u4',
    name: 'Nurul Ain Bte Rashid',
    email: 'nurul@kbmi.com',
    role: 'member',
    branch: 'Cawangan Woodlands',
    avatar: 'NA',
    joinedAt: '2024-02-10',
    totalContributed: 450,
  },
  {
    id: 'u5',
    name: 'Zulkifli Bin Mansor',
    email: 'zul@kbmi.com',
    role: 'member',
    branch: 'Cawangan Jurong',
    avatar: 'ZM',
    joinedAt: '2024-03-01',
    totalContributed: 150,
  },
  {
    id: 'u6',
    name: 'Rohani Bte Ibrahim',
    email: 'rohani@kbmi.com',
    role: 'member',
    branch: 'Cawangan Johor',
    avatar: 'RI',
    joinedAt: '2024-03-15',
    totalContributed: 300,
  },
]

// ─── Mock Announcements ───────────────────────────────────────────────────────
export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'Majlis Hari Raya Aidilfitri 2025 – Jangan Lepaskan!',
    content:
      'Salam sejahtera kepada semua ahli KBMI. Kami dengan sukacitanya menjemput semua ahli keluarga untuk hadir ke Majlis Hari Raya Aidilfitri 2025. Acara ini akan diadakan pada bulan April di rumah Pak Long di Tampines. Butiran lanjut akan diumumkan tidak lama lagi. Sila pastikan anda menandakan kehadiran anda melalui tab Kalendar.\n\nAcara tahun ini akan lebih meriah dengan pelbagai aktiviti seperti pertandingan kuih raya, cabutan bertuah, dan makan tengah hari bersama. Jangan lupa bawa keluarga anda!',
    media: [
      { type: 'image', url: 'https://picsum.photos/seed/raya1/800/600', caption: 'Suasana Hari Raya tahun lalu' },
      { type: 'image', url: 'https://picsum.photos/seed/raya2/800/600', caption: 'Keluarga bersama' },
      { type: 'image', url: 'https://picsum.photos/seed/raya3/800/600', caption: 'Hidangan istimewa' },
    ],
    authorId: 'u1',
    authorName: 'Ahmad Razif Mat Indra',
    createdAt: '2025-03-10',
    isPinned: true,
    likedBy: [],
    comments: [
      {
        id: 'c1',
        authorId: 'u3',
        authorName: 'Farid Bin Hashim',
        content: 'Insya-Allah kami sekeluarga akan hadir! Tak sabar tunggu!',
        createdAt: '2025-03-11',
      },
      {
        id: 'c2',
        authorId: 'u4',
        authorName: 'Nurul Ain Bte Rashid',
        content: 'Alhamdulillah, terima kasih atas jemputan. Kami confirm hadir.',
        createdAt: '2025-03-12',
      },
    ],
  },
  {
    id: 'a2',
    title: 'Kutipan Dana KBMI 2025 Kini Dibuka',
    content:
      'Ahli-ahli KBMI yang dihormati, kutipan dana tahunan bagi tahun 2025 kini telah dibuka. Sumbangan setiap ahli adalah sebanyak SGD 50 per keluarga. Dana ini akan digunakan untuk menampung kos majlis-majlis keluarga, aktiviti kebajikan, dan keperluan-keperluan lain.\n\nSila layari tab Keluarga > Sumbangan untuk maklumat lanjut mengenai cara membayar melalui PayNow. Semua sumbangan perlu diselesaikan sebelum 31 Mac 2025.',
    media: [
      { type: 'image', url: 'https://picsum.photos/seed/fund1/800/600', caption: 'Kutipan Dana 2025' },
    ],
    authorId: 'u2',
    authorName: 'Siti Hajar Bte Yusof',
    createdAt: '2025-01-15',
    isPinned: false,
    likedBy: [],
    comments: [
      {
        id: 'c3',
        authorId: 'u5',
        authorName: 'Zulkifli Bin Mansor',
        content: 'Sudah transfer. Terima kasih atas pemberitahuan!',
        createdAt: '2025-01-16',
      },
    ],
  },
  {
    id: 'a3',
    title: 'Ahli Jawatankuasa Exco 2025 yang Baru',
    content:
      'Dengan ini kami mengumumkan senarai Ahli Jawatankuasa Exco KBMI bagi tahun 2025. Terima kasih kepada semua yang telah memberi kepercayaan kepada mereka. Semoga mereka dapat menjalankan amanah dengan penuh dedikasi demi kesejahteraan seluruh keluarga besar kita.',
    media: [],
    authorId: 'u1',
    authorName: 'Ahmad Razif Mat Indra',
    createdAt: '2025-01-05',
    isPinned: false,
    likedBy: [],
    comments: [],
  },
]

// ─── Mock Events ──────────────────────────────────────────────────────────────
export const MOCK_EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Majlis Hari Raya Aidilfitri 2025',
    description: 'Sambutan Hari Raya tahunan KBMI. Hadir dan bersama-sama meraikan kegembiraan bersama seluruh keluarga. Makan tengah hari akan disediakan.',
    media: [
      { type: 'image', url: 'https://picsum.photos/seed/event1a/800/600', caption: 'Suasana majlis' },
      { type: 'image', url: 'https://picsum.photos/seed/event1b/800/600', caption: 'Hidangan istimewa' },
    ],
    date: '2025-04-12',
    time: '11:00 AM',
    location: '45 Tampines Street 81, Singapore 521045',
    createdBy: 'u1',
    rsvps: [
      { userId: 'u3', userName: 'Farid Bin Hashim', status: 'attending' },
      { userId: 'u4', userName: 'Nurul Ain Bte Rashid', status: 'attending' },
      { userId: 'u5', userName: 'Zulkifli Bin Mansor', status: 'maybe' },
      { userId: 'u6', userName: 'Rohani Bte Ibrahim', status: 'attending' },
    ],
  },
  {
    id: 'e2',
    title: 'Mesyuarat Agung Tahunan KBMI 2025',
    description: 'Mesyuarat tahunan untuk membentangkan laporan kewangan, aktiviti tahun lalu, dan merancang program untuk tahun 2026. Kehadiran semua ahli exco adalah diwajibkan.',
    media: [],
    date: '2025-06-07',
    time: '2:00 PM',
    location: 'Sengkang Community Club, Function Room 3',
    createdBy: 'u1',
    rsvps: [
      { userId: 'u2', userName: 'Siti Hajar Bte Yusof', status: 'attending' },
      { userId: 'u3', userName: 'Farid Bin Hashim', status: 'attending' },
    ],
  },
  {
    id: 'e3',
    title: 'Family Day Picnic @ East Coast Park',
    description: 'Jom bersantai bersama keluarga di East Coast Park! Bawa tikar, makanan ringan dan jangan lupa baju jersi KBMI. Ada aktiviti sukan, permainan kanak-kanak dan BBQ petang.',
    media: [
      { type: 'image', url: 'https://picsum.photos/seed/event3/800/600', caption: 'East Coast Park' },
    ],
    date: '2025-08-16',
    time: '9:00 AM',
    location: 'East Coast Park, Area G Shelter',
    createdBy: 'u2',
    rsvps: [
      { userId: 'u4', userName: 'Nurul Ain Bte Rashid', status: 'attending' },
      { userId: 'u5', userName: 'Zulkifli Bin Mansor', status: 'attending' },
      { userId: 'u6', userName: 'Rohani Bte Ibrahim', status: 'not_attending' },
    ],
  },
]

// ─── Mock Marketplace Listings ────────────────────────────────────────────────
export const MOCK_LISTINGS: MarketplaceListing[] = [
  {
    id: 'm1',
    sellerId: 'u3',
    sellerName: 'Farid Bin Hashim',
    title: 'Kuih Bangkit Homemade – Order for Raya',
    description:
      'Kuih bangkit buatan sendiri. Wangi, rangup dan sedap! Minimum order 2 balang. Boleh hantar dalam kawasan Tampines dan Pasir Ris.',
    price: 'SGD 12 / balang',
    category: 'sale',
    createdAt: '2025-03-01',
    expiresAt: '2026-06-15',
    photos: ['https://picsum.photos/seed/kuih1/800/600'],
  },
  {
    id: 'm2',
    sellerId: 'u4',
    sellerName: 'Nurul Ain Bte Rashid',
    title: 'Jual: Stroller Bayi Maclaren – Condition 9/10',
    description:
      'Stroller Maclaren Quest warna hijau. Sudah jarang digunakan kerana anak sudah besar. Lengkap dengan rain cover. Boleh uji sendiri.',
    price: 'SGD 80 (nego)',
    category: 'sale',
    createdAt: '2025-02-20',
    expiresAt: '2026-05-01',
    photos: ['https://picsum.photos/seed/stroller1/800/600', 'https://picsum.photos/seed/stroller2/800/600'],
  },
  {
    id: 'm3',
    sellerId: 'u6',
    sellerName: 'Rohani Bte Ibrahim',
    title: 'Perkhidmatan Jahit Baju & Pengubahsuaian',
    description:
      'Menerima tempahan jahit baju kurung, baju Melayu, dan pengubahsuaian pakaian. Harga bergantung kepada jenis kerja. Hubungi untuk sebut harga.',
    price: 'Dari SGD 15',
    category: 'service',
    createdAt: '2025-02-15',
    expiresAt: '2026-06-01',
  },
  {
    id: 'm4',
    sellerId: 'u5',
    sellerName: 'Zulkifli Bin Mansor',
    title: 'Cari: Kerusi Makan Bayi (Highchair)',
    description:
      'Sedang mencari highchair untuk bayi umur 6 bulan ke atas. Kalau ada ahli keluarga yang hendak jual atau pinjamkan, sila hubungi saya.',
    price: 'Budget: SGD 30–50',
    category: 'request',
    createdAt: '2025-03-05',
    expiresAt: '2026-05-10',
  },
  {
    id: 'm5',
    sellerId: 'u2',
    sellerName: 'Siti Hajar Bte Yusof',
    title: 'Kelas Mengaji Online – Untuk Kanak-kanak',
    description:
      'Menawarkan kelas mengaji online untuk kanak-kanak umur 5–12 tahun. Menggunakan kaedah Iqra\'. Jadual fleksibel. Percubaan pertama percuma.',
    price: 'SGD 40 / bulan (4 sesi)',
    category: 'service',
    createdAt: '2025-01-20',
    expiresAt: '2026-05-20',
    photos: ['https://picsum.photos/seed/mengaji1/800/600'],
  },
]

// ─── Mock Contribution Drives ─────────────────────────────────────────────────
export const MOCK_DRIVES: ContributionDrive[] = [
  {
    id: 'd1',
    title: 'Kutipan Dana Tahunan KBMI 2025',
    description:
      'Sumbangan tahunan bagi menampung kos majlis keluarga, aktiviti kebajikan, dan keperluan operasi KBMI sepanjang tahun 2025.',
    amountType: 'fixed',
    fixedAmount: 100,
    targetAmount: 5000,
    payNowName: 'KBMI Fund',
    payNowNumber: '9123 4567',
    deadline: '2025-03-31',
    status: 'active',
    hofOnly: false,
    expenses: [
      { id: 'ex1', description: 'Sewa Dewan Komuniti', amount: 350, date: '2025-02-01', category: 'event' },
      { id: 'ex2', description: 'Cetakan Brosur & Banner', amount: 120, date: '2025-02-15', category: 'admin' },
      { id: 'ex3', description: 'Hadiah & Saguhati', amount: 200, date: '2025-03-10', category: 'charity' },
    ],
    contributions: [
      { id: 'k1', userId: 'u1', userName: 'Ahmad Razif Mat Indra', amount: 100, paidAt: '2025-01-10', confirmed: true, confirmedBy: 'u2' },
      { id: 'k2', userId: 'u2', userName: 'Siti Hajar Bte Yusof', amount: 100, paidAt: '2025-01-12', confirmed: true, confirmedBy: 'u1' },
      { id: 'k3', userId: 'u4', userName: 'Nurul Ain Bte Rashid', amount: 100, paidAt: '2025-01-14', confirmed: true, confirmedBy: 'u2' },
      { id: 'k4', userId: 'u6', userName: 'Rohani Bte Ibrahim', amount: 100, paidAt: '2025-01-18', confirmed: true, confirmedBy: 'u2' },
      { id: 'k5', userId: 'u3', userName: 'Farid Bin Hashim', amount: 100, paidAt: '2025-01-25', confirmed: false },
    ],
  },
  {
    id: 'd2',
    title: 'Tabung Hari Raya 2024',
    description: 'Kutipan khas bagi menampung kos majlis Hari Raya Aidilfitri 2024.',
    amountType: 'flexible',
    minimumAmount: 50,
    targetAmount: 3000,
    payNowName: 'KBMI Fund',
    payNowNumber: '9123 4567',
    deadline: '2024-03-01',
    status: 'closed',
    hofOnly: false,
    expenses: [
      { id: 'ex4', description: 'Katering Majlis Raya', amount: 800, date: '2024-04-10', category: 'event' },
      { id: 'ex5', description: 'Duit Raya Kanak-kanak', amount: 300, date: '2024-04-10', category: 'charity' },
    ],
    contributions: [
      { id: 'k6', userId: 'u1', userName: 'Ahmad Razif Mat Indra', amount: 200, paidAt: '2024-01-10', confirmed: true, confirmedBy: 'u2' },
      { id: 'k7', userId: 'u2', userName: 'Siti Hajar Bte Yusof', amount: 150, paidAt: '2024-01-12', confirmed: true, confirmedBy: 'u1' },
      { id: 'k8', userId: 'u3', userName: 'Farid Bin Hashim', amount: 100, paidAt: '2024-01-20', confirmed: true, confirmedBy: 'u1' },
      { id: 'k9', userId: 'u4', userName: 'Nurul Ain Bte Rashid', amount: 200, paidAt: '2024-01-22', confirmed: true, confirmedBy: 'u2' },
      { id: 'k10', userId: 'u5', userName: 'Zulkifli Bin Mansor', amount: 150, paidAt: '2024-02-01', confirmed: true, confirmedBy: 'u2' },
      { id: 'k11', userId: 'u6', userName: 'Rohani Bte Ibrahim', amount: 200, paidAt: '2024-02-05', confirmed: true, confirmedBy: 'u1' },
    ],
  },
]

// ─── Mock Exco ────────────────────────────────────────────────────────────────
export const MOCK_EXCO: ExcoMember[] = [
  { id: 'x1', userId: 'u1', name: 'Ahmad Razif Mat Indra', position: 'Pengerusi', avatar: 'AR', since: '2023' },
  { id: 'x2', userId: 'u2', name: 'Siti Hajar Bte Yusof', position: 'Setiausaha', avatar: 'SH', since: '2023' },
  { id: 'x3', userId: 'u6', name: 'Rohani Bte Ibrahim', position: 'Bendahari', avatar: 'RI', since: '2024' },
  { id: 'x4', userId: 'u4', name: 'Nurul Ain Bte Rashid', position: 'AJK Kebajikan', avatar: 'NA', since: '2023' },
  { id: 'x5', userId: 'u5', name: 'Zulkifli Bin Mansor', position: 'AJK Sukan & Rekreasi', avatar: 'ZM', since: '2024' },
]

// ─── Mock Group Chats ─────────────────────────────────────────────────────────
export const MOCK_CHATS: GroupChat[] = [
  {
    id: 'g1',
    name: 'KBMI – Utama',
    platform: 'whatsapp',
    url: 'https://chat.whatsapp.com/example1',
    description: 'Kumpulan utama semua ahli KBMI. Pengumuman dan perbincangan umum.',
    sortOrder: 0,
  },
  {
    id: 'g2',
    name: 'KBMI – Exco 2025',
    platform: 'whatsapp',
    url: 'https://chat.whatsapp.com/example2',
    description: 'Kumpulan khusus untuk ahli jawatankuasa exco 2025.',
    sortOrder: 1,
  },
  {
    id: 'g3',
    name: 'KBMI – Cawangan Johor',
    platform: 'telegram',
    url: 'https://t.me/example3',
    description: 'Kumpulan untuk ahli keluarga yang tinggal di Johor.',
    sortOrder: 2,
  },
  {
    id: 'g4',
    name: 'KBMI – Generasi Muda',
    platform: 'whatsapp',
    url: 'https://chat.whatsapp.com/example4',
    description: 'Khas untuk anak-anak muda KBMI. Jom join!',
    sortOrder: 3,
  },
]

// ─── Mock Feedback ────────────────────────────────────────────────────────────
export const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: 'f1',
    userId: 'u3',
    userName: 'Farid Bin Hashim',
    content: 'Boleh ke acara family day sediakan lebih banyak aktiviti untuk kanak-kanak kecil bawah 5 tahun?',
    contactDetails: 'farid@email.com',
    requestFollowUp: true,
    status: 'open',
    createdAt: '2025-03-08',
  },
  {
    id: 'f2',
    userId: 'u5',
    userName: 'Zulkifli Bin Mansor',
    content: 'Terima kasih exco atas usaha menganjurkan majlis Hari Raya. Sangat meriah dan berjaya!',
    contactDetails: '',
    requestFollowUp: false,
    status: 'resolved',
    createdAt: '2025-02-01',
  },
]

// ─── Notifications ────────────────────────────────────────────────────────────
export interface Notification {
  id: string
  type: 'announcement' | 'event' | 'drive' | 'listing'
  title: string
  message: string
  createdAt: string
  readBy: string[]
  hofOnly?: boolean
  targetUserId?: string
}

export const MOCK_NOTIFICATIONS: Notification[] = []

// ─── Audit Log ────────────────────────────────────────────────────────────────
export type AuditCategory = 'Announcement' | 'Event' | 'Finance' | 'User' | 'Feedback' | 'Marketplace'

export interface AuditEntry {
  id: string
  category: AuditCategory
  activity: string
  initiatedBy: string
  timestamp: string  // ISO 8601 datetime
}

export const MOCK_AUDIT: AuditEntry[] = [
  { id: 'al1',  category: 'Announcement', activity: 'Published announcement: "Hari Raya Gathering 2026"',                        initiatedBy: 'Ahmad Razif Mat Indra', timestamp: '2026-02-15T09:30:00' },
  { id: 'al2',  category: 'Finance',      activity: 'Created fund collection: "Annual Family Fund 2026"',                        initiatedBy: 'Ahmad Razif Mat Indra', timestamp: '2026-02-20T14:15:00' },
  { id: 'al3',  category: 'User',         activity: 'Changed role of Siti Hajar Bte Yusof to Admin',                            initiatedBy: 'Ahmad Razif Mat Indra', timestamp: '2026-03-01T10:00:00' },
  { id: 'al4',  category: 'Finance',      activity: 'Recorded payment for Nurul Ain Bte Rashid (SGD 50) in "Annual Family Fund 2026"', initiatedBy: 'Siti Hajar Bte Yusof', timestamp: '2026-03-10T11:25:00' },
  { id: 'al5',  category: 'Event',        activity: 'Published event: "Family Day @ East Coast Park"',                          initiatedBy: 'Siti Hajar Bte Yusof', timestamp: '2026-03-12T08:45:00' },
  { id: 'al6',  category: 'Feedback',     activity: 'Submitted feedback',                                                        initiatedBy: 'Farid Bin Hashim',      timestamp: '2026-03-20T20:10:00' },
  { id: 'al7',  category: 'Feedback',     activity: 'Marked feedback from Farid Bin Hashim as resolved',                        initiatedBy: 'Ahmad Razif Mat Indra', timestamp: '2026-03-25T09:00:00' },
  { id: 'al8',  category: 'Marketplace',  activity: 'Posted marketplace listing: "Air fryer — excellent condition"',             initiatedBy: 'Nurul Ain Bte Rashid', timestamp: '2026-04-01T16:30:00' },
  { id: 'al9',  category: 'Event',        activity: 'RSVP\'d Attending to event: "Family Day @ East Coast Park"',               initiatedBy: 'Farid Bin Hashim',      timestamp: '2026-04-05T19:15:00' },
  { id: 'al10', category: 'Finance',      activity: 'Updated treasury stats (Collected: SGD 2,500, Spent: SGD 800)',            initiatedBy: 'Ahmad Razif Mat Indra', timestamp: '2026-04-15T10:30:00' },
  { id: 'al11', category: 'User',         activity: 'Set Nurul Ain Bte Rashid as Head of Family',                               initiatedBy: 'Ahmad Razif Mat Indra', timestamp: '2026-04-20T08:20:00' },
  { id: 'al12', category: 'Finance',      activity: 'Added expense: "Venue rental" (SGD 300) for "Annual Family Fund 2026"',    initiatedBy: 'Siti Hajar Bte Yusof', timestamp: '2026-05-01T13:45:00' },
]

// ─── Polls ────────────────────────────────────────────────────────────────────
export interface PollOption {
  id: string
  text: string
  votes: string[] // user IDs
}

export interface Poll {
  id: string
  question: string
  options: PollOption[]
  allowMultiple: boolean
  createdAt: string
  expiresAt: string
  createdById: string
  createdByName: string
  isActive: boolean
}

export const MOCK_POLLS: Poll[] = [
  {
    id: 'poll1',
    question: 'Where should we hold the next family gathering?',
    options: [
      { id: 'poll1o1', text: 'East Coast Park',  votes: ['u2', 'u4', 'u5'] },
      { id: 'poll1o2', text: 'Botanic Gardens',  votes: ['u3'] },
      { id: 'poll1o3', text: 'Sentosa Island',   votes: ['u6'] },
      { id: 'poll1o4', text: 'Pasir Ris Park',   votes: ['u1'] },
    ],
    allowMultiple: false,
    createdAt: '2026-05-01',
    expiresAt: '2026-05-31',
    createdById: 'u1',
    createdByName: 'Ahmad Razif Mat Indra',
    isActive: true,
  },
  {
    id: 'poll2',
    question: 'Which activities would you like at the gathering? (Choose all that apply)',
    options: [
      { id: 'poll2o1', text: 'BBQ',                   votes: ['u1', 'u2', 'u3', 'u5'] },
      { id: 'poll2o2', text: 'Sports & games',         votes: ['u2', 'u4'] },
      { id: 'poll2o3', text: 'Family photo session',   votes: ['u1', 'u3', 'u6'] },
      { id: 'poll2o4', text: 'Kids activities',        votes: ['u4', 'u5', 'u6'] },
    ],
    allowMultiple: true,
    createdAt: '2026-05-03',
    expiresAt: '2026-05-25',
    createdById: 'u1',
    createdByName: 'Ahmad Razif Mat Indra',
    isActive: true,
  },
  {
    id: 'poll3',
    question: 'Should we organise a family trip this year?',
    options: [
      { id: 'poll3o1', text: 'Yes — within Singapore',    votes: ['u1', 'u2', 'u3'] },
      { id: 'poll3o2', text: 'Yes — overseas trip',       votes: ['u4', 'u5'] },
      { id: 'poll3o3', text: 'No, not this year',         votes: ['u6'] },
    ],
    allowMultiple: false,
    createdAt: '2026-04-10',
    expiresAt: '2026-04-30',
    createdById: 'u2',
    createdByName: 'Siti Hajar Bte Yusof',
    isActive: false,
  },
]

// ─── Helper: compute contribution scores ─────────────────────────────────────
export function computeScores(users: User[], drives: ContributionDrive[]) {
  const scores: Record<string, number> = {}
  users.forEach((u) => { scores[u.id] = 0 })
  drives.forEach((drive) => {
    drive.contributions.forEach((c) => {
      if (c.confirmed) scores[c.userId] = (scores[c.userId] || 0) + c.amount
    })
  })
  return scores
}
