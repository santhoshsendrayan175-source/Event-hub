import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { ArrowRight, Bell, Bookmark, CalendarDays, Check, ChevronDown, Clock3, Compass, Heart, ImagePlus, LogIn, LogOut, MapPin, Menu, Plus, Search, Sparkles, Ticket, Users, X } from 'lucide-react'
import './eventhub.css'

type GeoPoint = { type: 'Point'; coordinates: [number, number] }
type EventItem = { _id: string; title: string; category: string; date: string; time: string; location: string; venue: string; description: string; image: string; price: number; capacity: number; registeredCount: number; organizer: string; format: 'In person' | 'Online'; coordinates?: GeoPoint; distanceKm?: number }
type Session = { id: string; name: string; email: string; role: 'attendee' | 'organizer' | 'admin'; token: string }
type AuthMode = 'login' | 'register'
type SortMode = 'upcoming' | 'popular' | 'price'
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`
const images = [photo('photo-1555939594-58d7cb561ad1'), photo('photo-1531058020387-3be344556be6'), photo('photo-1501386761578-eac5c94b800a'), photo('photo-1519389950473-47ba0277781c'), photo('photo-1470252649378-9c29740c9fa8'), photo('photo-1540575467063-178a50c2df87')]
const categories = ['Everything', 'Technology', 'Design', 'Music', 'Food & drink', 'Outdoors', 'Community']
const demoEvents: EventItem[] = [
  { _id: 'e1', title: 'The Good Food Gathering', category: 'Food & drink', date: '2026-10-18', time: '11:00 AM', location: 'Brooklyn, NY', venue: 'Domino Park', description: 'A long-table kind of Sunday. Meet the neighborhood chefs, makers, and growers behind the food we love. Come hungry, leave with new favorites.', image: images[0], price: 18, capacity: 240, registeredCount: 184, organizer: 'Gather & Co.', format: 'In person' },
  { _id: 'e2', title: 'Make / Believe: A Creative Summit', category: 'Design', date: '2026-10-22', time: '9:30 AM', location: 'New York, NY', venue: 'The Foundry', description: 'A day for people who make things. Studio talks, curious conversations, and hands-on workshops with an open invitation to think differently.', image: images[1], price: 45, capacity: 320, registeredCount: 276, organizer: 'Soft Serve Studio', format: 'In person' },
  { _id: 'e3', title: 'Afterglow Sessions', category: 'Music', date: '2026-10-24', time: '7:00 PM', location: 'Queens, NY', venue: 'Knockdown Center', description: 'An intimate night of live music, good sound, and very little standing still. Featuring a hand-picked lineup of local artists.', image: images[2], price: 28, capacity: 180, registeredCount: 143, organizer: 'Sunday Sound', format: 'In person' },
  { _id: 'e4', title: 'Build What Matters', category: 'Technology', date: '2026-10-29', time: '10:00 AM', location: 'New York, NY', venue: 'Industry City', description: 'A practical gathering for people building a more thoughtful internet. Small-group sessions, real case studies, and time to meet your next collaborator.', image: images[3], price: 0, capacity: 500, registeredCount: 312, organizer: 'Future Friendly', format: 'In person' },
  { _id: 'e5', title: 'A Little Further: Trail Day', category: 'Outdoors', date: '2026-11-01', time: '8:00 AM', location: 'Hudson Valley, NY', venue: 'Minnewaska State Park', description: 'Trade the group chat for fresh air. A welcoming guided hike with good views, a relaxed pace, and a picnic waiting at the end.', image: images[4], price: 12, capacity: 60, registeredCount: 38, organizer: 'Outside Together', format: 'In person' },
  { _id: 'e6', title: 'People, Product & Possibility', category: 'Community', date: '2026-11-05', time: '6:00 PM', location: 'Brooklyn, NY', venue: 'The Yard', description: 'No pitches, no panels that could have been emails. Just smart, generous people sharing what they are learning over a good meal.', image: images[5], price: 10, capacity: 120, registeredCount: 78, organizer: 'Common Ground', format: 'In person' },
]
const demoCoordinates: [number, number][] = [[-73.967, 40.7148], [-73.957, 40.747], [-73.917, 40.722], [-74.008, 40.657], [-74.24, 41.73], [-73.984, 40.697]]
demoEvents.forEach((event, index) => { event.coordinates = { type: 'Point', coordinates: demoCoordinates[index] } })
const emptyEvents: EventItem[] = []
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const today = new Date().toISOString().slice(0, 10)
const distanceInKm = (latitude: number, longitude: number, point: GeoPoint) => {
  const [pointLongitude, pointLatitude] = point.coordinates
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(pointLatitude - latitude)
  const longitudeDelta = radians(pointLongitude - longitude)
  const term = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(pointLatitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term))
}
const geocodeVenue = async (searchTerm: string): Promise<GeoPoint | undefined> => {
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchTerm)}&limit=1`)
    if (!response.ok) return undefined
    const result = await response.json() as { features?: { properties?: { type?: string }; geometry?: { coordinates?: number[] } }[] }
    const feature = result.features?.[0]
    if (!feature || ['city', 'county', 'district', 'state', 'country'].includes(feature.properties?.type || '')) return undefined
    const [longitude, latitude] = feature.geometry?.coordinates || []
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? { type: 'Point', coordinates: [longitude, latitude] } : undefined
  } catch { return undefined }
}

function App() {
  const [events, setEvents] = useState(demoEvents)
  const [category, setCategory] = useState('Everything')
  const [sortMode, setSortMode] = useState<SortMode>('upcoming')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [view, setView] = useState('Discover')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saved, setSaved] = useState<string[]>([])
  const [registered, setRegistered] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [nearbyMode, setNearbyMode] = useState(false)
  const [nearbyEvents, setNearbyEvents] = useState<EventItem[] | null>(null)
  const [nearbyRadius, setNearbyRadius] = useState(50)
  const [currentPoint, setCurrentPoint] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem('eventhub-session') || 'null') as Session | null } catch { return null }
  })
  useEffect(() => { axios.get<EventItem[]>('/api/events').then(({ data }) => { if (data.length) setEvents(data) }).catch(() => undefined) }, [])
  useEffect(() => {
    if (!session) { delete axios.defaults.headers.common.Authorization; return }
    axios.defaults.headers.common.Authorization = `Bearer ${session.token}`
    axios.get<{ event: EventItem }[]>('/api/users/me/registrations').then(({ data }) => setRegistered(data.map((item) => item.event?._id).filter(Boolean))).catch(() => undefined)
  }, [session])
  const visibleEvents = nearbyMode ? nearbyEvents || emptyEvents : events
  const filtered = useMemo(() => visibleEvents.filter((event) => (category === 'Everything' || event.category === category) && `${event.title} ${event.location} ${event.category} ${event.organizer}`.toLowerCase().includes(query.toLowerCase()) && (view !== 'Saved' || saved.includes(event._id)) && (view !== 'My tickets' || registered.includes(event._id))), [visibleEvents, category, query, view, saved, registered])
  const sortedEvents = useMemo(() => [...filtered].sort((first, second) => {
    if (sortMode === 'popular') return second.registeredCount - first.registeredCount
    if (sortMode === 'price') return first.price - second.price
    return first.date.localeCompare(second.date)
  }), [filtered, sortMode])
  const locationCount = new Set(events.map((event) => event.location.split(',')[0].trim().toLowerCase()).filter(Boolean)).size
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }
  const authenticate = async (mode: AuthMode, fields: { name?: string; email: string; password: string; role?: string }) => {
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const { data } = await axios.post<{ token: string; user: Omit<Session, 'token'> }>(endpoint, fields)
      const account = { ...data.user, token: data.token }
      localStorage.setItem('eventhub-session', JSON.stringify(account))
      setSession(account)
      setAuthMode(null)
      notify(`Welcome${account.name ? `, ${account.name.split(' ')[0]}` : ''}.`)
      return null
    } catch (error) {
      if (axios.isAxiosError(error)) return error.response?.data?.message || 'Connect MongoDB to sign in or create an account.'
      return 'Could not connect to EventHub. Check that the API is running.'
    }
  }
  const signOut = () => { localStorage.removeItem('eventhub-session'); setSession(null); setRegistered([]); notify('You’ve signed out.') }
  const findNearbyEvents = async (point: { latitude: number; longitude: number }, radius: number) => {
    setLocating(true)
    let matches: EventItem[] = events.flatMap((event) => {
      const geoPoint = event.coordinates
      if (!geoPoint || !Array.isArray(geoPoint.coordinates) || geoPoint.coordinates.length !== 2 || !geoPoint.coordinates.every(Number.isFinite)) return []
      return [{ ...event, distanceKm: distanceInKm(point.latitude, point.longitude, geoPoint) }]
    })
      .filter((event) => event.distanceKm !== undefined && event.distanceKm <= radius)
      .sort((first, second) => (first.distanceKm || 0) - (second.distanceKm || 0))
    try {
      const { data: health } = await axios.get<{ database: string }>('/api/health')
      if (health.database === 'connected') {
        const { data } = await axios.get<EventItem[]>('/api/events/nearby', { params: { lat: point.latitude, lng: point.longitude, radiusKm: radius } })
        matches = data
      }
    } catch { /* Keep the locally calculated demo results. */ }
    setNearbyEvents(matches)
    setNearbyMode(true)
    setLocating(false)
  }
  const toggleNearby = () => {
    if (nearbyMode) { setNearbyMode(false); setNearbyEvents(null); setCurrentPoint(null); return }
    if (!navigator.geolocation) { notify('Location is not available in this browser.'); return }
    setCategory('Everything')
    setView('Discover')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const point = { latitude: coords.latitude, longitude: coords.longitude }
      setCurrentPoint(point)
      void findNearbyEvents(point, nearbyRadius)
    }, () => { setLocating(false); notify('Allow location access to find nearby events.') }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }
  const changeNearbyRadius = (radius: number) => {
    setNearbyRadius(radius)
    if (currentPoint) void findNearbyEvents(currentPoint, radius)
  }
  const register = async (event: EventItem, name: string, email: string, phone: string) => {
    try { await axios.post(`/api/events/${event._id}/register`, { name, email, phone }) } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status !== 503) { notify(error.response.data?.message || 'Could not complete registration.'); return }
      if (event.registeredCount >= event.capacity) { notify('This event is full.'); return }
    }
    setRegistered((items) => items.includes(event._id) ? items : [...items, event._id]); setEvents((items) => items.map((item) => item._id === event._id ? { ...item, registeredCount: Math.min(item.registeredCount + 1, item.capacity) } : item)); setSelected(null); notify(`You’re on the list for ${event.title}.`)
  }
  const publish = async (event: EventItem) => {
    const authoredEvent = { ...event, organizer: session?.name || 'Guest organizer' }
    try { const { data } = await axios.post<EventItem>('/api/events', { ...authoredEvent, _id: undefined }); setEvents((items) => [data, ...items]) } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status !== 503) { notify(error.response.data?.message || 'Could not publish this event.'); return }
      if (!images.includes(authoredEvent.image)) { notify('Could not save this event and its image. Connect to MongoDB, then try again.'); return }
      setEvents((items) => [{ ...authoredEvent, _id: `local-${Date.now()}` }, ...items])
    }
    setCreateOpen(false); setView('Discover'); setCategory('Everything'); notify('Your event is live. Let’s get people together.')
  }
  const nav = [{ label: 'Discover', icon: Compass }, { label: 'My tickets', icon: Ticket }, { label: 'Saved', icon: Bookmark }]
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><a className="brand" href="#discover" onClick={() => setView('Discover')}><span className="brand-mark"><Sparkles size={18} /></span><span>event<span className="brand-light">hub</span></span></a><div className="side-label">YOUR SPACE</div><nav className="side-nav" aria-label="Main navigation">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${view === label ? 'active' : ''}`} onClick={() => { setView(label); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{label === 'My tickets' && registered.length > 0 && <span className="nav-count">{registered.length}</span>}</button>)}</nav><div className="side-divider" /><div className="side-label">MAKE IT HAPPEN</div><button className="nav-item organizer-link" onClick={() => setCreateOpen(true)}><Plus size={18} /><span>Create an event</span></button><div className="organizer-promo"><div className="promo-icon"><CalendarDays size={17} /></div><p>Your next good idea<br />deserves a crowd.</p><button onClick={() => setCreateOpen(true)}>Start planning <ArrowRight size={14} /></button><div className="promo-decoration">✳</div></div><div className="profile-row"><div className="avatar">{(session?.name || 'Guest').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div className="profile-copy"><strong>{session?.name || 'Guest organizer'}</strong><span>{session ? (session.role === 'organizer' ? 'Event organizer' : 'Event explorer') : 'Not signed in'}</span></div><button className="icon-button profile-menu" aria-label="Profile menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}><ChevronDown size={16} /></button></div>{profileMenuOpen && <div className="profile-menu-popover" role="menu" aria-label="Account menu">{session ? <><div className="profile-menu-account"><strong>{session.name}</strong><span>{session.email}</span></div><button role="menuitem" onClick={() => { signOut(); setProfileMenuOpen(false) }}><LogOut size={15} /> Sign out</button></> : <><button role="menuitem" onClick={() => { setAuthMode('login'); setProfileMenuOpen(false) }}><LogIn size={15} /> Sign in</button><button role="menuitem" onClick={() => { setAuthMode('register'); setProfileMenuOpen(false) }}><Plus size={15} /> Create account</button></>}</div>}</aside>
    <main className="main-area"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="breadcrumbs"><span>Explore</span><span className="crumb-slash">/</span><strong>{view}</strong></div><div className="topbar-actions"><label className="global-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, places..." /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><i /></button>{session ? <button className="account-button" onClick={signOut}><LogOut size={15} /><span>{session.name.split(' ')[0]}</span></button> : <button className="account-button" onClick={() => setAuthMode('login')}><LogIn size={15} /><span>Sign in</span></button>}<button className="create-button" onClick={() => setCreateOpen(true)}><Plus size={17} /><span>Create event</span></button></div></header>
      <div className="page-content"><section className="welcome-row"><div><p className="eyebrow"><span className="eyebrow-dot" /> YOUR CITY, YOUR PEOPLE</p><h1>Good things happen<br className="desktop-break" /> when we <span>show up.</span></h1></div><div className="welcome-note"><span className="note-star">✳</span><p>Make room for a little<br />something different.</p></div></section>
        <section className="feature-banner"><img src={photo('photo-1540575467063-178a50c2df87')} alt="People gathering at a creative event" /><div className="feature-shade" /><div className="feature-copy"><div className="feature-kicker"><span>THE EVENT EDIT</span><i /></div><h2>More life.<br />Less scrolling.</h2><p>Find your next favorite thing to do.</p><button onClick={() => document.getElementById('event-list')?.scrollIntoView({ behavior: 'smooth' })}>Explore what’s on <ArrowRight size={16} /></button></div><div className="feature-index"><strong>01</strong><i /> 03</div><div className="feature-stamp">GOOD<br />TOGETHER</div></section>
        <section className="quick-stats"><div><span className="stat-icon stat-coral"><Users size={17} /></span><p><strong>{events.length}</strong><span>events listed</span></p></div><div><span className="stat-icon stat-yellow"><MapPin size={17} /></span><p><strong>{locationCount}</strong><span>event locations</span></p></div><div className="stats-note"><Sparkles size={15} /><span>Good plans are closer than you think.</span></div></section>
        <section className="events-section" id="event-list">
          <div className="section-heading"><div><p className="eyebrow section-eyebrow">A LITTLE SOMETHING FOR EVERYONE</p><h2>{view === 'Discover' ? 'Find your kind of thing' : view}</h2></div><button className="filter-button" onClick={() => { setCategory('Everything'); setQuery('') }}>Reset filters</button></div>
          <div className="browse-toolbar"><div className="category-scroll" role="tablist" aria-label="Filter events by category">{categories.map((item) => <button role="tab" aria-selected={category === item} key={item} className={`category-tab ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="browse-tools"><button className={`nearby-button ${nearbyMode ? 'nearby-active' : ''}`} onClick={toggleNearby} disabled={locating}><MapPin size={14} />{locating ? 'Locating…' : nearbyMode ? 'Near you' : 'Near me'}</button>{nearbyMode && <select className="radius-select" aria-label="Nearby search radius" value={nearbyRadius} onChange={(event) => changeNearbyRadius(Number(event.target.value))}><option value={10}>10 km</option><option value={25}>25 km</option><option value={50}>50 km</option><option value={100}>100 km</option></select>}<div className="sort-control"><button className="sort-button" aria-expanded={sortMenuOpen} onClick={() => setSortMenuOpen((open) => !open)}>{sortMode === 'upcoming' ? 'Upcoming' : sortMode === 'popular' ? 'Most popular' : 'Price: low to high'}<ChevronDown size={14} /></button>{sortMenuOpen && <div className="sort-menu" role="menu" aria-label="Sort events">{([{ key: 'upcoming', label: 'Upcoming' }, { key: 'popular', label: 'Most popular' }, { key: 'price', label: 'Price: low to high' }] as const).map((option) => <button key={option.key} role="menuitem" className={sortMode === option.key ? 'sort-option selected' : 'sort-option'} onClick={() => { setSortMode(option.key); setSortMenuOpen(false) }}>{option.label}</button>)}</div>}</div></div></div>
          <div className="event-grid">{sortedEvents.map((event, index) => <EventCard key={event._id} event={event} index={index} saved={saved.includes(event._id)} onOpen={() => setSelected(event)} onSave={() => setSaved((items) => items.includes(event._id) ? items.filter((id) => id !== event._id) : [...items, event._id])} />)}</div>
          {filtered.length === 0 && <div className="empty-state"><span className="empty-icon">✳</span><h3>{nearbyMode ? `No events within ${nearbyRadius} km.` : 'Nothing on the calendar just yet.'}</h3><p>{nearbyMode ? 'Try a wider radius or return to all events.' : 'Try another category, or clear your search and see what’s happening.'}</p><button onClick={() => nearbyMode ? toggleNearby() : (setQuery(''), setCategory('Everything'), setView('Discover'))}>{nearbyMode ? 'Show all events' : 'Show me everything'}</button></div>}
        </section><footer className="page-footer"><span>© 2026 EventHub</span><span>Made for showing up <b>♥</b></span><a href="https://github.com" target="_blank" rel="noreferrer">Community guidelines</a></footer></div>
    </main>
    {notificationsOpen && <NotificationPanel events={events} registered={registered} onClose={() => setNotificationsOpen(false)} onOpenEvent={(event) => { setNotificationsOpen(false); setSelected(event) }} />}
    {selected && <EventDialog event={selected} registered={registered.includes(selected._id)} onClose={() => setSelected(null)} onRegister={register} />}{createOpen && <CreateDialog onClose={() => setCreateOpen(false)} onCreate={publish} onWarning={notify} />}{authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onSubmit={authenticate} />}{toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>
}

function NotificationPanel({ events, registered, onClose, onOpenEvent }: { events: EventItem[]; registered: string[]; onClose: () => void; onOpenEvent: (event: EventItem) => void }) {
  const registeredEvents = events.filter((event) => registered.includes(event._id))
  const upcomingEvents = events.filter((event) => event.date >= today && !registered.includes(event._id)).slice(0, 3)
  const formatNoticeDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return <section className="notification-panel" role="dialog" aria-label="Notifications"><header className="notification-header"><div><span className="eyebrow">EVENTHUB UPDATES</span><h2>Activity</h2></div><button className="notification-close" aria-label="Close notifications" onClick={onClose}><X size={17} /></button></header>
    {registeredEvents.length > 0 && <div className="notification-group"><span className="notification-label">YOUR REGISTRATIONS</span>{registeredEvents.map((event) => <button className="notification-item" key={event._id} onClick={() => onOpenEvent(event)}><span className="notice-symbol notice-confirmed"><Check size={14} /></span><span className="notice-copy"><strong>Registration confirmed</strong><span>{event.title}</span><small>{formatNoticeDate(event.date)} · {event.location}</small></span></button>)}</div>}
    {upcomingEvents.length > 0 && <div className="notification-group"><span className="notification-label">COMING UP</span>{upcomingEvents.map((event) => <button className="notification-item" key={event._id} onClick={() => onOpenEvent(event)}><span className="notice-symbol"><CalendarDays size={14} /></span><span className="notice-copy"><strong>{event.title}</strong><span>{formatNoticeDate(event.date)} · {event.time}</span><small>{event.location}</small></span></button>)}</div>}
    {registeredEvents.length === 0 && upcomingEvents.length === 0 && <div className="notification-empty"><Bell size={19} /><p>You’re all caught up.</p><span>New event updates will show here.</span></div>}
  </section>
}

function EventCard({ event, index, saved, onOpen, onSave }: { event: EventItem; index: number; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const date = new Date(`${event.date}T12:00:00`); const percent = Math.min(100, Math.round(event.registeredCount / event.capacity * 100))
  return <article className="event-card" style={{ animationDelay: `${index * 70}ms` }}><button className="event-image-button" onClick={onOpen} aria-label={`View ${event.title}`}><img src={event.image} alt="" /><span className="event-category">{event.category}</span><span className="event-date"><strong>{date.toLocaleDateString('en-US', { day: '2-digit' })}</strong><span>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span></span></button><div className="event-info"><div className="event-meta"><span><Clock3 size={13} /> {event.time}</span><i>·</i><span><MapPin size={13} /> {event.distanceKm !== undefined ? `${event.distanceKm} km away` : event.location.split(',')[0]}</span></div><button className="event-title" onClick={onOpen}>{event.title}</button><div className="event-organizer"><span className="organizer-avatar">{event.organizer.slice(0, 1)}</span><span>by <strong>{event.organizer}</strong></span><button className={`save-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Remove from saved events' : 'Save event'} onClick={onSave}><Heart size={16} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="event-card-bottom"><span className="event-price">{event.price === 0 ? 'Free' : `$${event.price}`}</span><span className="spots-note"><i><b style={{ width: `${percent}%` }} /></i>{event.capacity - event.registeredCount} spots left</span></div></div></article>
}

function EventDialog({ event, registered, onClose, onRegister }: { event: EventItem; registered: boolean; onClose: () => void; onRegister: (event: EventItem, name: string, email: string, phone: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (form: FormEvent<HTMLFormElement>) => { form.preventDefault(); setBusy(true); await onRegister(event, name, email, phone); setBusy(false) }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="event-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" aria-label="Close" onClick={onClose}><X size={19} /></button><img className="dialog-image" src={event.image} alt="" /><div className="dialog-body"><span className="dialog-category">{event.category} <i /> {event.format}</span><h2 id="dialog-title">{event.title}</h2><div className="dialog-facts"><span><CalendarDays size={16} /> {shortDate(event.date)} · {event.time}</span><span><MapPin size={16} /> {event.venue}, {event.location}</span></div><p className="dialog-description">{event.description}</p><div className="dialog-host"><span className="host-avatar">{event.organizer.slice(0, 1)}</span><span>Hosted by <strong>{event.organizer}</strong></span><span className="dialog-price">{event.price ? `$${event.price}` : 'Free'}<small> / person</small></span></div>{registered ? <div className="registered-note"><Check size={17} /> You’re registered. See you there!</div> : <form className="register-form" onSubmit={submit}><label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoComplete="name" required /></label><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" autoComplete="email" required /></label><label className="register-phone">Phone number<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" pattern="[+0-9(). -]{7,30}" title="Enter a phone number with at least 7 digits." required /></label><button type="submit" disabled={busy || event.registeredCount >= event.capacity}>{busy ? 'Registering…' : event.registeredCount >= event.capacity ? 'Event is full' : 'Register for event'}<ArrowRight size={16} /></button></form>}</div></section></div>
}

function CreateDialog({ onClose, onCreate, onWarning }: { onClose: () => void; onCreate: (event: EventItem) => Promise<void>; onWarning: (message: string) => void }) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState('')
  const [busy, setBusy] = useState(false)
  const [imagePreview, setImagePreview] = useState('')
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  const submit = async (form: FormEvent<HTMLFormElement>) => {
    form.preventDefault()
    setBusy(true)
    setImageError('')
    try {
      const data = new FormData(form.currentTarget)
      const selectedCategory = String(data.get('category'))
      const photoIndex = categories.indexOf(selectedCategory) % images.length
      const location = String(data.get('location'))
      const venue = String(data.get('venue'))
      let image = images[photoIndex]
      if (imageFile) {
        const upload = new FormData()
        upload.append('image', imageFile)
        const response = await axios.post<{ url: string }>('/api/events/image', upload)
        image = response.data.url
      }
      const coordinates = await geocodeVenue(`${venue}, ${location}`)
      if (!coordinates) onWarning('We could not pinpoint that venue. The event will publish, but may not appear in Nearby. Add a street address or area for a more precise result.')
      await onCreate({ _id: '', title: String(data.get('title')), category: selectedCategory, date: String(data.get('date')), time: String(data.get('time')), location, venue, description: String(data.get('description')), image, price: Number(data.get('price')), capacity: Number(data.get('capacity')), registeredCount: 0, organizer: 'Guest organizer', format: String(data.get('format')) as EventItem['format'], coordinates })
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined
      setImageError(message || 'Could not upload your image. Please try again.')
    } finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}><section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title"><header className="create-header"><div><span className="eyebrow">MAKE SOMETHING HAPPEN</span><h2 id="create-title">Start with a good idea.</h2></div><button className="dialog-close" aria-label="Close" onClick={onClose} disabled={busy}><X size={19} /></button></header><form className="create-form" onSubmit={submit}><label className="form-wide">Event name<input name="title" placeholder="Give your gathering a name" required /></label><label>Category<select name="category">{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Format<select name="format"><option>In person</option><option>Online</option></select></label><label>Date<input type="date" name="date" min={today} required /></label><label>Start time<input type="time" name="time" required /></label><label className="form-wide">Venue / building or street address<input name="venue" placeholder="Convention centre, Anna Salai" required /><small className="location-helper">Add the venue or street/area, then enter the city below.</small></label><label>City, State<input name="location" placeholder="Chennai, Tamil Nadu" required /></label><label>Ticket price ($)<input name="price" type="number" min="0" defaultValue="0" required /></label><label>Capacity<input name="capacity" type="number" min="1" defaultValue="100" required /></label><label className="form-wide image-upload-field">Event cover image<span className="image-upload-control"><ImagePlus size={17} /><input type="file" accept="image/jpeg,image/png,image/webp" onClick={(event) => { event.currentTarget.value = '' }} onChange={(event) => { const file = event.currentTarget.files?.[0] || null; if (file && file.size > 5 * 1024 * 1024) { setImageFile(null); setImagePreview(''); setImageError('Choose an image smaller than 5 MB.'); return } setImageError(''); setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : '') }} /></span><small className="location-helper">JPG, PNG, or WebP up to 5 MB. Leave empty to use the category image.</small></label>{imagePreview && <div className="image-preview form-wide"><img src={imagePreview} alt="Selected event cover preview" /><button type="button" aria-label="Remove selected image" onClick={() => { setImageFile(null); setImagePreview('') }}><X size={16} /></button></div>}{imageError && <p className="upload-error form-wide" role="alert">{imageError}</p>}<label className="form-wide">A little about it<textarea name="description" rows={3} placeholder="What makes this one worth showing up for?" required /></label><button type="submit" className="publish-button" disabled={busy}>{busy ? 'Uploading and publishing…' : 'Publish event'} <ArrowRight size={16} /></button></form></section></div>
}

function AuthDialog({ mode, onModeChange, onClose, onSubmit }: { mode: AuthMode; onModeChange: (mode: AuthMode) => void; onClose: () => void; onSubmit: (mode: AuthMode, fields: { name?: string; email: string; password: string; role?: string }) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (form: FormEvent<HTMLFormElement>) => {
    form.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(form.currentTarget)
    const message = await onSubmit(mode, { name: String(data.get('name') || ''), email: String(data.get('email')), password: String(data.get('password')), role: String(data.get('role') || 'attendee') })
    setBusy(false)
    if (message) setError(message)
  }
  return <div className="modal-backdrop auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" aria-label="Close sign in" onClick={onClose}><X size={18} /></button><div className="auth-art"><span className="brand-mark"><Sparkles size={19} /></span><strong>event<span>hub</span></strong><p>Good things happen<br />when we show up.</p><div className="auth-art-orbit">✳</div></div><div className="auth-content"><span className="eyebrow">YOUR NEXT GOOD THING STARTS HERE</span><h2 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Come on in.'}</h2><p className="auth-intro">{mode === 'login' ? 'Sign in to find your tickets and saved events.' : 'Create an account and find your people.'}</p><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { onModeChange('login'); setError('') }}>Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { onModeChange('register'); setError('') }}>Create account</button></div><form className="auth-form" onSubmit={submit}>{mode === 'register' && <label>Your name<input name="name" autoComplete="name" placeholder="Alex Morgan" required /></label>}<label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} placeholder="At least 8 characters" required /></label>{mode === 'register' && <label>Account type<select name="role"><option value="attendee">Attendee</option><option value="organizer">Event organizer</option></select></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></button></form><p className="auth-terms">Your account details stay private.</p></div></section></div>
}

export default App
