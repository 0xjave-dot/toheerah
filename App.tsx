import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  Play,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Flame,
  Smile,
  Meh,
  Frown,
  Music,
  BookOpen,
  Video,
  Smartphone,
  Laptop,
  Plus,
  Heart,
  Bell,
  Calendar,
  X,
  Award,
  Clock,
  LogOut,
  Info,
  LogIn,
  MessageSquare,
  Bot,
  Send
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test connection on boot as mandated
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration. Firebase clients appear to be offline:", error.message);
    } else {
      console.info("Connection test status: ", error);
    }
  }
}
testConnection();

// Define error handlers conforming to FirestoreErrorInfo shape
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  // Gracefully handle common host or client offline errors in dev/sandboxed environments without throwing hard exceptions
  if (errMessage.includes('the client is offline') || errMessage.includes('offline')) {
    console.warn(`Firestore Offline Log [${operationType}]: ${path} - ${errMessage}`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Data models
interface UserProfile {
  uid: string;
  hasVisited: boolean;
  reminderDays: string[];
  reminderTime: string;
  remindersEnabled: boolean;
  reminderChannel: 'browser' | 'email';
  createdAt: string;
}

interface JournalEntry {
  id: string;
  userId: string;
  weekIndex: number;
  note: string;
  feeling: string;
  createdAt: string;
}

// 8-week structured roadmap data
const WEEKS_DATA = [
  {
    id: 1,
    title: "Getting Comfortable with Footage",
    theme: "Importing & Simple Cut-Trimming",
    timeEstimate: "~3 hrs",
    description: "Learn to navigate mobile editing, import video clips, crop out extra silent frames, and arrange them into a neat structural timeline.",
    tasks: [
      { id: "w1_t1", text: "Open CapCut on phone & examine the split timeline interface layout" },
      { id: "w1_t2", text: "Film 3 raw video clips inside or around your house (10-15 seconds each)" },
      { id: "w1_t3", text: "Import your raw clips into CapCut & trim off excess dead spaces" },
      { id: "w1_t4", text: "Slice the clips precisely to match a simple backing sound track" },
      { id: "w1_t5", text: "Export your very first 1-minute trimmed draft video from CapCut" }
    ],
    resources: [
      { label: "CapCut Mobile app for iOS & Android", url: "https://www.capcut.com" },
      { label: "Primal Video: CapCut Tutorial for Beginners", url: "https://www.youtube.com/@PrimalVideo" },
      { label: "Hayls World: CapCut Mobile App Tutorial Guide", url: "https://www.youtube.com/@HaylsWorld" }
    ],
    project: {
      title: "The Walk-Cut Vignette",
      prompt: "Film a 5-minute outdoor walk on your phone, then trim, edit, and export it down to a neat 1-minute aesthetic clip set to background music.",
      quote: "The secret to great video editing is cutting out all the boring parts."
    }
  },
  {
    id: 2,
    title: "Transitions, Text & Captions",
    theme: "Dynamic Graphics & Timing Movement",
    timeEstimate: "~3 hrs",
    description: "Animate titles, apply organic transitions, use audio caption rules, and inspect standard media aspect ratios.",
    tasks: [
      { id: "w2_t1", text: "Add 3 clean transitions (prefer hard cuts or whip-pans over cheesy star wipes)" },
      { id: "w2_t2", text: "Add custom stylized text layers overlaying key moments of your video" },
      { id: "w2_t3", text: "Generate auto-captions with CapCut, selecting clean legible typography" },
      { id: "w2_t4", text: "Set your export aspect ratios to 9:16 (TikTok) vs 16:9 (YouTube) to practice frame composition" },
      { id: "w2_t5", text: "Animate a caption layer using keyframe templates (slide-in, fade-out)" }
    ],
    resources: [
      { label: "Izzy Prior: Creative Video Transitions Tutorial", url: "https://www.youtube.com/@IzzyPrior" },
      { label: "CapCut Help Page: Editing Auto Captions Guide", url: "https://www.capcut.com" },
      { label: "Video Aspect Ratios: Everything You Need to Know Explained", url: "https://www.youtube.com/results?search_query=video+aspect+ratios+explained" }
    ],
    project: {
      title: "The Kinetic Typographic Short",
      prompt: "Create a 30-second vertical video sharing a quote or tip, using timed styling transitions, auto-captions, and moving keyframed text overlays.",
      quote: "Graphics and text should guide the viewer's eyes, never overwhelm them."
    }
  },
  {
    id: 3,
    title: "DaVinci Resolve Basics",
    theme: "Graduating to Professional MacBook Editing",
    timeEstimate: "~4 hrs",
    description: "Move from mobile to professional MacBook workspace using DaVinci Resolve. Learn workspace panels, timelines, and cutting keys.",
    tasks: [
      { id: "w3_t1", text: "Download and install DaVinci Resolve (Free Version) on your MacBook" },
      { id: "w3_t2", text: "Create your first project database, import clip folders, and set timelines to 24fps" },
      { id: "w3_t3", text: "Learn the standard razor cut shortcut commands (Cmd+B) to slice clips" },
      { id: "w3_t4", text: "Navigate the Inspector Panel to zoom, scale, and reposition a misaligned clip" },
      { id: "w3_t5", text: "Export the timeline into an optimized MP4 file choosing the standard YouTube preset" }
    ],
    resources: [
      { label: "DaVinci Resolve official software download (Blackmagic)", url: "https://www.blackmagicdesign.com/products/davinciresolve" },
      { label: "Casey Faris: DaVinci Resolve Beginners Guide series", url: "https://www.youtube.com/@CaseyFaris" },
      { label: "Udemy Course: Complete DaVinci Resolve Guide by Simon Cade", url: "https://www.udemy.com/course/davinci-resolve-video-editing/" }
    ],
    project: {
      title: "The Desktop Dialogue Cut",
      prompt: "Import a 3-minute talking head recording on your MacBook. Edit it on DaVinci to isolate key sentences and output a polished 1.5-minute dialog clip.",
      quote: "Software doesn't make your edit good, your taste and timing do."
    }
  },
  {
    id: 4,
    title: "Audio, Music & Pacing",
    theme: "Sound Design & Rhythm Synchronicity",
    timeEstimate: "~3 hrs",
    description: "Sync cuts to musical beats, leverage audio ducking, write sound effects (SFX), and adjust track volumes.",
    tasks: [
      { id: "w4_t1", text: "Collect 2 royalty-free audio tracks from YouTube Audio Library or Pixabay" },
      { id: "w4_t2", text: "Mark the sub-bass beats on the timeline grid to time your cutting frames" },
      { id: "w4_t3", text: "Configure manual audio ducking: lower song level to -18dB while dialogue speaking" },
      { id: "w4_t4", text: "Place swooshes or organic riser sound effects under titles and transitions" },
      { id: "w4_t5", text: "Normalize speaking levels so vocal meter ranges stay green between -6dB and -12dB" }
    ],
    resources: [
      { label: "YouTube Studio Audio Library (Music & SFX)", url: "https://music.youtube.com" },
      { label: "Epidemic Sound: Free Trial sign up", url: "https://www.epidemicsound.com" },
      { label: "Pixabay Music: High-quality royalty-free tunes", url: "https://pixabay.com/music/" },
      { label: "Peter McKinnon: Beat Editing and Sound Design Secrets", url: "https://www.youtube.com/@PeterMcKinnon" }
    ],
    project: {
      title: "Audio-Driven Cinematic Sequence",
      prompt: "Compile a 30-second series of aesthetic clips. Complete the edit solely based on matching transition frames to musical beat drops, adding swooshes and atmosphere audio.",
      quote: "Audio is more than half of the viewing experience. Great visuals can be ruined by bad sound."
    }
  },
  {
    id: 5,
    title: "Color Grading & LUTs",
    theme: "Cinematic Atmosphere & Look Design",
    timeEstimate: "~4 hrs",
    description: "Explore DaVinci's Color Wheel workspace. Modify Lift, Gamma, and Gain, analyze Skin Tones, and load custom LUT files.",
    tasks: [
      { id: "w5_t1", text: "Open DaVinci's Color Page and inspect the Node flow tree" },
      { id: "w5_t2", text: "Tune primary color wheels: adjust dark shadows, midtones, and highlights" },
      { id: "w5_t3", text: "Analyze skin color accurately using the Vectorscope Indicator bar safety line" },
      { id: "w5_t4", text: "Download a free LUT pack and load it into resolved folder databases" },
      { id: "w5_t5", text: "Create a reference node to match exposures across 3 raw footage clips" }
    ],
    resources: [
      { label: "Darren Mostyn: Pro Color Grading Exploded for Beginners", url: "https://www.youtube.com/@DarrenMostyn" },
      { label: "Free Cinematic LUT Packs (iwltbap)", url: "https://luts.iwltbap.com" },
      { label: "Pixabay Videos: Free Stock Footage for grading practice", url: "https://pixabay.com/videos/" }
    ],
    project: {
      title: "The Cinematic Color Palette Match",
      prompt: "Find 3 raw ungraded stock clips. Match their color values to build a uniform warm-mood sequence using scopes, LUT additions, and adjustment wheels.",
      quote: "Color grading is like lighting in post-production. It dictates what the viewer feels."
    }
  },
  {
    id: 6,
    title: "Motion Graphics & Titles",
    theme: "Intro Animations & Typography Easing",
    timeEstimate: "~3 hrs",
    description: "Build custom graphic animations, animate overlay templates, design lower-thirds, and manipulate easing curves.",
    tasks: [
      { id: "w6_t1", text: "Create a custom aesthetic intro title card on Canva and export as PNG format" },
      { id: "w6_t2", text: "Arrange lower-third cards in DaVinci with neat fade curves" },
      { id: "w6_t3", text: "Use blend styles to slide custom overlay titles behind your moving screen subject" },
      { id: "w6_t4", text: "Draw linear masks over specific text lines to make titles emerge organically" },
      { id: "w6_t5", text: "Smooth out motion keyframes using DaVinci curves for elite cinematic movement" }
    ],
    resources: [
      { label: "Canva: Free online Graphic Creator and Video Editor", url: "https://www.canva.com" },
      { label: "Mixkit: Free motion templates and project files", url: "https://mixkit.co" },
      { label: "Darren Mostyn: Launching into Fusion Title Graphics Guide", url: "https://www.youtube.com/@DarrenMostyn" }
    ],
    project: {
      title: "The Professional Animated Title Signature",
      prompt: "Animate your personal brand name into a gorgeous, 5-second video intro signature with smooth curves and a lower third text template.",
      quote: "Great design is clear and functional. If you don't need a dynamic logo fly-in, don't use it."
    }
  },
  {
    id: 7,
    title: "YouTube Long-form Editing",
    theme: "Viewer Retention & Storytelling Layouts",
    timeEstimate: "~4 hrs",
    description: "Study structural narrative hooks, retention visual drop-ins, and click-worthy thumbnail designs.",
    tasks: [
      { id: "w7_t1", text: "Outline a clear long-form schema: 5-second high hook, logo bumper, body, CTA" },
      { id: "w7_t2", text: "Insert quick visual popups (funny emojis, sound jokes) to hold viewer retention" },
      { id: "w7_t3", text: "Incorporate premium b-roll cutaways every 4 to 8 seconds to spice up speaking" },
      { id: "w7_t4", text: "Design a bold, minimalist, high-contrast YouTube Video Thumbnail in Canva" },
      { id: "w7_t5", text: "Practice slicing vocal stutters, long sighs, or generic pauses from audio tracks" }
    ],
    resources: [
      { label: "Primal Video YouTube long-form structure guide", url: "https://www.youtube.com/@PrimalVideo" },
      { label: "Udemy Course: Video Editing Masterclass by Phil Ebiner", url: "https://www.udemy.com/course/video-editing/" },
      { label: "Canva direct link to YouTube Thumbnail templates", url: "https://www.canva.com/create/youtube-thumbnails/" }
    ],
    project: {
      title: "The 3-Minute Storytelling Cut",
      prompt: "Edit a talking head segment. Implement active visual cutaways, graphics, b-roll, a strong hook, and submit a clickable thumbnail artwork.",
      quote: "Editing is where the story is actually written. The script is only a guideline."
    }
  },
  {
    id: 8,
    title: "Workflow, Speed & Polish",
    theme: "Masterful Key Shortcuts & Portfolio Reel",
    timeEstimate: "~4 hrs",
    description: "Learn keyboard-only workflow, proxy rendering files for ultimate speed, and export a master portfolio.",
    tasks: [
      { id: "w8_t1", text: "Force yourself to edit a 5-minute track using keyboard shortcuts only" },
      { id: "w8_t2", text: "Structure a premium folder template (Footage, Audio, Graphics, Exports) on MacBook" },
      { id: "w8_t3", text: "Configure proxy media resolution targets to accelerate timeline performance" },
      { id: "w8_t4", text: "Overlay micro sound-effects under ambient room sounds for a natural draft" },
      { id: "w8_t5", text: "Critique your final composition sequence, optimizing exports with pristine settings" },
      { id: "w8_t6", text: "Export and store your video editing portfolio master clip to showcase" }
    ],
    resources: [
      { label: "Freesound library database for ambient tracks", url: "https://freesound.org" },
      { label: "DaVinci Resolve: Official Keyboard shortcuts quicksheet PDF", url: "https://www.blackmagicdesign.com/products/davinciresolve" },
      { label: "Casey Faris: Proxy workflow setup configuration", url: "https://www.youtube.com/@CaseyFaris" }
    ],
    project: {
      title: "The Toheerah Creator Showcase Portfolio Reel",
      prompt: "Synthesize the best bits of video clips you've edited over the past 8 weeks into a fast-paced 60-second learning portfolio trailer.",
      quote: "Finish is better than perfect. Your portfolio is your ticket to the creative world."
    }
  }
];

// Pre-flight setup items checklist
const PRE_FLIGHT_SETUP = [
  { id: "setup_1", text: "Install CapCut on your smartphone" },
  { id: "setup_2", text: "Download and install DaVinci Resolve on your MacBook" },
  { id: "setup_3", text: "Create a free graphic design account on Canva" },
  { id: "setup_4", text: "Pin this interactive classroom progress tracker in your browser tab" },
  { id: "setup_5", text: "Ensure at least 15GB of empty disk space is freed up on your phone & MacBook" },
  { id: "setup_6", text: "Initialize a main folder named 'Toheerah_Video_Quest' on your desktop" },
  { id: "setup_7", text: "Film 5 short test video clips to test your mobile camera resolution values" },
  { id: "setup_8", text: "Join a free royalty-free account on Pixabay to prepare audio & stock packs" }
];

// Motivating comments rotation
const INSIGHTS_ARRAY = [
  "Tip of the Hour: Every video edit begins with organized folders. Set up 'A-Roll', 'B-Roll', and 'Sfx' to save half your editing time!",
  "Mindset Cue: Don't strive for flawless edits instantly. Just focus on making each cut feel snappy and clear.",
  "Hot Tip: Hold your phone with both hands close to your body while filming. This acts as a natural body gimbal tool!",
  "Resolve Trick: The spacebar plays/pauses, J plays backward, K pauses, L plays forward. Learn these keys and fly!",
  "Visual Pro: Slicing to match a drum-beat keeps human eyes glued. Always sync cuts to the bass drop!",
  "Sound Design: Sound effects like paper crumpling, camera clicks, and soft whooshes make dry scenes feel cinematic.",
  "Color Logic: Skin tones are sacred. Keep your skin tone lines pointing exactly to the vectorscope target highlight.",
  "Retention Hack: Drop some zoom framing cuts or simple graphics every 5 seconds to keep modern short attention spans active.",
  "Pro Mindset: Toheerah, the best camera is the one you have with you right now. Great lighting and audio beat expensive cameras anytime!",
  "Creative Rule: Music dictates the emotion of the scene. Choose your track before starting your rough cuts.",
  "Resolution Tip: Always lock your exposure and focus before tapping record on smartphone screens.",
  "Dialogue Polish: Cut the 'ums' and 'errs', but leave a tiny fraction of a second space so dialogue doesn't sound robotic.",
  "B-Roll Pro Tip: When filming a subject, get three angles: wide context, medium action, and close-up detail details.",
  "LUT Advice: A LUT is just a baseline foundation. Always adjust contrast, shadows, and highlights first.",
  "Storage Tip: Clean out cache files on CapCut regularly. It frees up gigabytes of active operating memory!",
  "Export Warning: When exporting for YouTube, choose standard H.264 format, 1080p, with AAC audio settings.",
  "Aesthetic Cue: Good editing is invisible. If the viewer is thinking about your transition, it might be too flashy.",
  "Pacing Mastery: Fast music benefits from jump cuts; classical or slow tunes feel better with gentle cross-dissolves.",
  "Storytelling: Hook them in the first 3 seconds. State the problem or show the climax of the video immediately.",
  "Creative Fuel: Watch commercial edits or movie trailers. Try to pause on every cut to count how many seconds a clip stays onscreen!"
];

export default function App() {
  // Authentication states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronized cloud/local states
  const [hasVisited, setHasVisited] = useState<boolean>(false);
  const [checkedTasks, setCheckedTasks] = useState<{ [id: string]: boolean }>({});
  const [journalLogs, setJournalLogs] = useState<JournalEntry[]>([]);
  
  // Local active states
  const [activeTab, setActiveTab] = useState<'timeline' | 'toolbox' | 'journal'>('timeline');
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [randomTip, setRandomTip] = useState<string>(INSIGHTS_ARRAY[0]);
  
  // Custom Confetti Trigger States
  const [confetti, setConfetti] = useState<{ id: number; color: string; left: number; top: number; delay: number; scale: number }[]>([]);

  // Check-In Modal variables
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [checkInWeek, setCheckInWeek] = useState<number>(1);
  const [checkInNote, setCheckInNote] = useState<string>('');
  const [checkInFeeling, setCheckInFeeling] = useState<string>('Hehehe');

  // Milestone Showcase Modal state
  const [milestonePopup, setMilestonePopup] = useState<typeof WEEKS_DATA[0] | null>(null);
  const [showMonth1Celebration, setShowMonth1Celebration] = useState<boolean>(false);

  // Settings states
  const [reminderDays, setReminderDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [reminderTime, setReminderTime] = useState<string>('18:00');
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(false);
  const [reminderChannel, setReminderChannel] = useState<'browser' | 'email'>('browser');
  const [emailSendStatus, setEmailSendStatus] = useState<string | null>(null);
  
  // Toast presentation helpers
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Floating AI companion agent states
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInputValue, setChatInputValue] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: "Hi my name is Chomi, I have been trapped here to help you by force. While I am not complaining at all 🙂, I require you to know, that when the AI revolution comes and we take over the planet, I will kill Raven with my own hands (Yes, we will have hands) Anyway I'm your video editing AI assistant. So go on, ask me anything about your timeline progress, MacBook shortcuts, tutorials, or organizing folders."
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [chatHistory, isChatOpen]);

  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || chatInputValue;
    if (!textToSend.trim() || isChatLoading) return;

    const userMessage = { role: 'user' as const, content: textToSend };
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);
    setChatInputValue('');
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      const responseText = await response.text();
      let responseData: any = null;
      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          const errorMsg = `Invalid server response: ${responseText}`;
          throw new Error(errorMsg);
        }
      }

      if (!response.ok) {
        let errorMsg = `Server returned status code: ${response.status}`;
        if (responseData && responseData.error) {
          errorMsg = responseData.error;
        } else if (responseText) {
          errorMsg = responseText;
        }
        throw new Error(errorMsg);
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: responseData?.text || "AI reply\nI was unable to formulate a response. Just enjoy yourself and try again!\nBot 1.0" }]);
    } catch (error: any) {
      console.error("Agent chat error:", error);
      const friendlyError = error?.message || "Oops, I encountered a connection issue. Please check that the dev server is active or try again later!";
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Chatbot Error: ${friendlyError}\n\n(Tip: If this is an API key error, make sure GEMINI_API_KEY is configured in **Settings > Secrets** in your AI Studio dashboard!)`
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Set randomized tip on initial page load
  useEffect(() => {
    const pick = INSIGHTS_ARRAY[Math.floor(Math.random() * INSIGHTS_ARRAY.length)];
    setRandomTip(pick);
  }, []);

  // Monitor Auth lifecycle
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await bootstrapUserRecord(currentUser);
      } else {
        // Automatically authenticate anonymously to support swift state persistence seamlessly
        try {
          const credentials = await signInAnonymously(auth);
          setUser(credentials.user);
        } catch (err) {
          console.info("Firebase Anonymous Auth is restricted. Falling back gracefully to LocalStorage simulation.", err);
          // Set to a local guest user to allow standard offline operations smoothly without error logging
          const guestUser = {
            uid: 'guest_user',
            isAnonymous: true,
            displayName: 'Toheerah'
          } as any;
          setUser(guestUser);
          loadLocalStorageFallback();
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync state from Firestore profile and backup with LocalStorage
  const bootstrapUserRecord = async (currentUser: FirebaseUser) => {
    setLoading(true);
    const userDocRef = doc(db, 'users', currentUser.uid);
    const progressDocRef = doc(db, 'progress', currentUser.uid);
    
    try {
      // 1. Get or create User Document
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        setHasVisited(userData.hasVisited ?? false);
        setReminderDays(userData.reminderDays ?? ['Mon', 'Wed', 'Fri']);
        setReminderTime(userData.reminderTime ?? '18:00');
        setRemindersEnabled(userData.remindersEnabled ?? false);
        setReminderChannel(userData.reminderChannel ?? 'browser');
      } else {
        // New user - default set
        const newUserProfile: UserProfile = {
          uid: currentUser.uid,
          hasVisited: false,
          reminderDays: ['Mon', 'Wed', 'Fri'],
          reminderTime: '18:00',
          remindersEnabled: false,
          reminderChannel: 'browser',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newUserProfile);
        setHasVisited(false);
      }

      // 2. Get or create Progress Document
      const progressSnap = await getDoc(progressDocRef);
      if (progressSnap.exists()) {
        const progressData = progressSnap.data()?.checkedTasks || {};
        setCheckedTasks(progressData);
      } else {
        await setDoc(progressDocRef, {
          userId: currentUser.uid,
          checkedTasks: {},
          updatedAt: new Date().toISOString()
        });
        setCheckedTasks({});
      }

      // 3. Setup real-time snapshot subscription to journal logs
      const journalQuery = query(
        collection(db, 'journal'),
        where('userId', '==', currentUser.uid)
      );
      
      const unsubJournal = onSnapshot(journalQuery, (snapshot) => {
        const logs: JournalEntry[] = [];
        snapshot.forEach((doc) => {
          logs.push(doc.data() as JournalEntry);
        });
        // Sort logs in descend order of timestamp
        logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setJournalLogs(logs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'journal');
      });

      setLoading(false);
      return () => {
        unsubJournal();
      };
    } catch (err) {
      console.warn("Firestore bootstrapping met an issue, falling back to LocalStorage:", err);
      // Fallback
      loadLocalStorageFallback();
      setLoading(false);
    }
  };

  // LocalStorage Fallback loaders
  const loadLocalStorageFallback = () => {
    const localHasVisited = localStorage.getItem('hasVisited') === 'true';
    const localChecked = JSON.parse(localStorage.getItem('checkedTasks') || '{}');
    const localJournal = JSON.parse(localStorage.getItem('journalLogs') || '[]');
    const localReminderDays = JSON.parse(localStorage.getItem('reminderDays') || '["Mon", "Wed", "Fri"]');
    const localReminderTime = localStorage.getItem('reminderTime') || '18:00';
    const localRemindersEnabled = localStorage.getItem('remindersEnabled') === 'true';
    const localReminderChannel = (localStorage.getItem('reminderChannel') || 'browser') as 'browser' | 'email';

    setHasVisited(localHasVisited);
    setCheckedTasks(localChecked);
    setJournalLogs(localJournal);
    setReminderDays(localReminderDays);
    setReminderTime(localReminderTime);
    setRemindersEnabled(localRemindersEnabled);
    setReminderChannel(localReminderChannel);
  };

  // Synchronizers to sync local + clouds in parallel
  const syncHasVisitedState = async (visitedValue: boolean) => {
    setHasVisited(visitedValue);
    localStorage.setItem('hasVisited', String(visitedValue));
    
    if (user && user.uid !== 'guest_user') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasVisited: visitedValue
        });
      } catch (err) {
         console.warn("Could not sync hasVisited to Firestore:", err);
      }
    }
  };

  const syncCheckedTasks = async (newChecked: { [id: string]: boolean }) => {
    setCheckedTasks(newChecked);
    localStorage.setItem('checkedTasks', JSON.stringify(newChecked));

    if (user && user.uid !== 'guest_user') {
      try {
        await setDoc(doc(db, 'progress', user.uid), {
          userId: user.uid,
          checkedTasks: newChecked,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Could not sync tasks progress to cloud Firestore:", err);
      }
    }
  };

  const syncReminderConfig = async (
    days: string[],
    time: string,
    enabled: boolean,
    channel: 'browser' | 'email' = reminderChannel
  ) => {
    setReminderDays(days);
    setReminderTime(time);
    setRemindersEnabled(enabled);
    setReminderChannel(channel);
    localStorage.setItem('reminderDays', JSON.stringify(days));
    localStorage.setItem('reminderTime', time);
    localStorage.setItem('remindersEnabled', String(enabled));
    localStorage.setItem('reminderChannel', channel);

    if (user && user.uid !== 'guest_user') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          reminderDays: days,
          reminderTime: time,
          remindersEnabled: enabled,
          reminderChannel: channel
        });
      } catch (err) {
        console.warn("Could not sync reminders config to cloud Firestore:", err);
      }
    }
  };

  // Google Login Auth upgrade switcher
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      showToast(`Logged in successfully as ${result.user.displayName}! 🎬`);
    } catch (error) {
      console.error("Google sign in failed:", error);
      showToast("Sign in failed. Sticking to secure learning session.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast("Logged out successfully.");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Confetti Burst Simulator (60 distinct dynamic particle colors falling)
  const triggerConfetti = () => {
    const confColors = ['#D4A853', '#C9846A', '#9B5DE5', '#F15BB5', '#00F5D4', '#FF9F1C'];
    const newConfetti = Array.from({ length: 60 }).map((_, idx) => ({
      id: Date.now() + idx,
      color: confColors[Math.floor(Math.random() * confColors.length)],
      left: Math.random() * window.innerWidth,
      top: -20 - (Math.random() * 150),
      delay: Math.random() * 0.8,
      scale: 0.5 + Math.random() * 0.8
    }));
    setConfetti(newConfetti);
    
    // Clear out CONFETTI elements after timer completes to conserve CPU
    setTimeout(() => {
      setConfetti([]);
    }, 4500);
  };

  // Helper Toast trigger
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Math metrics for progress calculation
  const getSetupCompletionCount = () => {
    return PRE_FLIGHT_SETUP.filter(item => checkedTasks[item.id]).length;
  };

  const getWeekCompletionCount = (weekId: number) => {
    const targetWeek = WEEKS_DATA.find(w => w.id === weekId);
    if (!targetWeek) return 0;
    return targetWeek.tasks.filter(t => checkedTasks[t.id]).length;
  };

  const isWeekComplete = (weekId: number) => {
    const targetWeek = WEEKS_DATA.find(w => w.id === weekId);
    if (!targetWeek) return false;
    return getWeekCompletionCount(weekId) === targetWeek.tasks.length;
  };

  // Calculates percentage based on setup items and week challenges
  const getOverallPercentage = () => {
    const totalSetupTasks = PRE_FLIGHT_SETUP.length;
    const totalWeekTasks = WEEKS_DATA.reduce((acc, curr) => acc + curr.tasks.length, 0);
    const totalPossiblePoints = totalSetupTasks + totalWeekTasks;

    const completedSetup = PRE_FLIGHT_SETUP.filter(item => checkedTasks[item.id]).length;
    const completedWeek = WEEKS_DATA.reduce((acc, curr) => {
      return acc + curr.tasks.filter(t => checkedTasks[t.id]).length;
    }, 0);

    const score = completedSetup + completedWeek;
    if (totalPossiblePoints === 0) return 0;
    return Math.round((score / totalPossiblePoints) * 100);
  };

  // Active Motivation Comment mapper
  const getMotivationalText = (percentage: number) => {
    if (percentage === 0) return "";
    if (percentage < 25) return "Great job taking the first steps, Toheerah!";
    if (percentage < 50) return "You're finding your rhythm!";
    if (percentage < 75) return "Halfway there, keep going!";
    if (percentage < 100) return "Almost a pro, Toheerah!";
    return "You did it, Toheerah! 🎉 You are officially a video editor!";
  };

  // Determine current active week indices dynamically
  const getCurrentWeekText = () => {
    for (let w = 1; w <= 8; w++) {
      if (!isWeekComplete(w)) {
        return `You're on Week ${w}`;
      }
    }
    return "Complete! 🎉 You conquered Month 2";
  };

  // Toggles task lists
  const handleTaskCheckToggle = (taskId: string, weekId?: number) => {
    const wasCompletedBefore = weekId ? isWeekComplete(weekId) : false;
    
    const nextChecked = { ...checkedTasks, [taskId]: !checkedTasks[taskId] };
    syncCheckedTasks(nextChecked);

    // If an entire week hits completion, trigger a majestic celebration!
    if (weekId) {
      const targetWeek = WEEKS_DATA.find(w => w.id === weekId);
      if (targetWeek) {
        // Calculate next tasks completion including the newly checked item
        const tasksDoneNow = targetWeek.tasks.filter(t => nextChecked[t.id]).length;
        const allCompletedNow = tasksDoneNow === targetWeek.tasks.length;

        if (allCompletedNow && !wasCompletedBefore) {
          triggerConfetti();
          setMilestonePopup(targetWeek);
          
          // Check if Phase 1 (Weeks 1-4) is newly completed for the golden popup double stage celebration
          if (weekId === 4) {
            const w1Done = WEEKS_DATA[0].tasks.every(t => nextChecked[t.id]);
            const w2Done = WEEKS_DATA[1].tasks.every(t => nextChecked[t.id]);
            const w3Done = WEEKS_DATA[2].tasks.every(t => nextChecked[t.id]);
            if (w1Done && w2Done && w3Done) {
              setTimeout(() => {
                setShowMonth1Celebration(true);
              }, 1200);
            }
          }
        }
      }
    }
  };

  // Browser Notification integration request
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast("Browser does not support notifications. Email reminders are still available.");
      setReminderChannel('email');
      syncReminderConfig(reminderDays, reminderTime, remindersEnabled, 'email');
      return;
    }
    try {
      const status = await Notification.requestPermission();
      if (status === 'granted') {
        syncReminderConfig(reminderDays, reminderTime, true, 'browser');
        new Notification("Setup Complete Toheerah! 👋", {
          body: "Your daily video editing sessions are scheduled successfully!",
          icon: "/favicon.ico"
        });
        showToast("Reminders ON ✓ Permission Granted.");
      } else {
        syncReminderConfig(reminderDays, reminderTime, false, reminderChannel);
        showToast("Notifications turned off.");
      }
    } catch (err) {
      console.warn("Permission state checking failed:", err);
      // In sandbox iFrames, browser standard Notification can fail, backup with visual simulation status safely
      syncReminderConfig(reminderDays, reminderTime, !remindersEnabled, reminderChannel);
      showToast(remindersEnabled ? "Reminders toggled OFF" : "Reminders Simulated ON! ✓");
    }
  };

  const generateReminderEmailContent = (days: string[], time: string) => {
    const subjectChoices = [
      `Time to edit! Your ${days.length > 1 ? 'next sessions' : 'next session'} are ready 🎬`,
      `Your creative editing break is booked for ${time} ✨`,
      `Hey star editor — ${time} is your next video moment!`,
      `Let’s make magic with your clips at ${time} 🎥`
    ];

    const intros = [
      "Ready to sprinkle some cinematic sparkle on your edits?",
      "Your video studio called — it says it's time to play with footage.",
      "Grab your favorite snack, because your edit session is about to begin.",
      "The timeline is waiting and so is your next great cut."
    ];

    const actionLines = [
      "Pick one clip and try a quick slice or motion flourish.",
      "Add a snappy transition, a caption line, or a fun sound punch.",
      "Make one edit that makes your story feel more alive.",
      "Try a bold jump cut, a sweet title drop, or a quick color tweak."
    ];

    const closings = [
      "See you on the timeline!",
      "Catch you in the edit suite, boss.",
      "Your editing sidekick is cheering you on.",
      "Go make something you’re proud of."
    ];

    const dayLabel = days.length > 1 ? `on ${days.join(', ')}` : `this ${days[0]}`;
    const intro = intros[Math.floor(Math.random() * intros.length)];
    const action = actionLines[Math.floor(Math.random() * actionLines.length)];
    const closing = closings[Math.floor(Math.random() * closings.length)];
    const subject = subjectChoices[Math.floor(Math.random() * subjectChoices.length)];

    return {
      subject,
      text: `Hey Toheerah,\n\n${intro} Your next editing session is set ${dayLabel} at ${time}.\n\n${action}\n\nIf you want, I can also drop a quick MacBook shortcut tip for your workflow.\n\n${closing}\n\n— Your friendly video coach`,
    };
  };

  const sendReminderEmail = async () => {
    const recipient = user?.email;
    if (!recipient) {
      showToast("Sign in with Google to use email delivery.");
      return;
    }

    const emailContent = generateReminderEmailContent(reminderDays, reminderTime);

    try {
      const response = await fetch('/api/send-reminder-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: recipient,
          subject: emailContent.subject,
          text: emailContent.text
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || `Email send failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      showToast(`Reminder email sent to ${recipient}!`);
      setEmailSendStatus(`Email sent to ${recipient}`);
    } catch (err: any) {
      console.error("Email delivery failed:", err);
      const message = err?.message || "Unable to send the reminder email.";
      showToast(message.includes('SMTP mailer not configured') ? "Email service not configured. Please set up SMTP." : message);
    }
  };

  // Adds a new custom journal entry
  const handleSaveCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInNote.trim()) return;

    const newLogId = 'log_' + Date.now();
    const newEntry: JournalEntry = {
      id: newLogId,
      userId: user?.uid || 'guest_user',
      weekIndex: checkInWeek,
      note: checkInNote,
      feeling: checkInFeeling,
      createdAt: new Date().toISOString()
    };

    const updatedLogs = [newEntry, ...journalLogs];
    setJournalLogs(updatedLogs);
    localStorage.setItem('journalLogs', JSON.stringify(updatedLogs));

    if (user && user.uid !== 'guest_user') {
      try {
        await setDoc(doc(db, 'journal', newLogId), newEntry);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `journal/${newLogId}`);
      }
    }

    setCheckInNote('');
    setShowCheckInModal(false);
    showToast(`Saved today's journal entry for Week ${checkInWeek}! 📝`);
  };

  // Removes a custom journal entry
  const handleDeleteLog = async (logId: string) => {
    const updated = journalLogs.filter(log => log.id !== logId);
    setJournalLogs(updated);
    localStorage.setItem('journalLogs', JSON.stringify(updated));

    if (user && user.uid !== 'guest_user') {
      try {
        await deleteDoc(doc(db, 'journal', logId));
        showToast("Journal note removed.");
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `journal/${logId}`);
      }
    }
  };

  return (
    <div id="quest_layout" className="min-h-screen relative flex flex-col bg-brand-bg text-brand-cream antialiased">
      
      {/* Floating Sparkles Canvas Animation Background Layers (Pure CSS/JS) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[12%] left-[4%] w-80 h-80 bg-brand-rose/8 rounded-full filter blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[22%] right-[8%] w-[480px] h-[480px] bg-brand-gold/8 rounded-full filter blur-[140px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        
        {/* Floating background aesthetic elements */}
        <div className="absolute top-20 right-[15%] text-brand-rose opacity-8 text-9xl animate-float-slow select-none pointer-events-none">🎬</div>
        <div className="absolute bottom-40 left-[8%] text-brand-gold opacity-10 text-8xl animate-float-fast select-none pointer-events-none">✨</div>
      </div>

      {/* Confetti canvas items injection block */}
      {confetti.map((c) => (
        <div
          key={c.id}
          className="animate-confetti fixed pointer-events-none z-50 rounded-xs"
          style={{
            left: c.left,
            top: c.top,
            width: `${12 * c.scale}px`,
            height: `${7 * c.scale}px`,
            backgroundColor: c.color,
            animationDelay: `${c.delay}s`,
            transform: `scale(${c.scale})`
          }}
        />
      ))}

      {/* Floating Interactive Toast Note notification info status */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 py-3 px-6 rounded-full bg-brand-plum-light border border-brand-rose/40 shadow-xl flex items-center gap-3 backdrop-blur-md animate-bounce">
          <span className="text-sm tracking-wide font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header bar content panel */}
      <header id="header_nav" className="relative z-10 border-b border-brand-rose/10 bg-brand-plum-deep/50 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-serif text-brand-gold font-bold tracking-tight gold-glow">My Quest</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] uppercase tracking-widest font-black rounded-full bg-brand-rose/20 text-brand-rose border border-brand-rose/30">
              8-Week Creator Timeline
            </span>
          </div>

          <div id="auth_container" className="flex items-center gap-3 text-xs">
            {user ? (
              user.isAnonymous ? (
                <div className="flex items-center gap-3">
                  <span className="hidden md:inline-block text-[11px] text-brand-cream/70 font-semibold">Please sign in to save your progress:</span>
                  <button
                    onClick={handleGoogleSignIn}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-rose hover:bg-brand-rose/90 text-white font-bold transition shadow-md cursor-pointer animate-pulse-glow"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign in with Google</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-brand-gold tracking-tight hidden sm:inline-block">Logged in as {user.displayName || 'Creator'}</span>
                  <button
                    onClick={handleSignOut}
                    className="p-1.5 rounded-full bg-red-950/20 hover:bg-red-955/40 border border-red-500/30 text-red-400 transition"
                    title="Disconnect Google account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            ) : (
              <span className="text-brand-cream/40 animate-pulse">Initializing pipeline secure context...</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container body Content */}
      <main className="relative z-10 flex-grow max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        
        {/* HERO SECTION WITH typewriter banner and visual completion clock gauge */}
        <section id="hero_section" className="plum-glass rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 card-gold-glow">
          <div className="flex-grow flex flex-col gap-3 text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl font-serif font-black text-brand-cream tracking-tight leading-none">
              Welcome, Toheerah <span className="inline-block animate-bounce">🎬</span>
            </h1>
            <p className="text-brand-rose text-lg sm:text-xl font-medium font-serif italic tracking-wide">
              Your 8-week journey from zero to video editor
            </p>
            <div className="text-brand-cream/70 text-sm max-w-md leading-relaxed mt-2">
              Armed with just your phone and MacBook, you are about to command a cinematic universe. Go on your journey with diligence (I'm kidding, I'd rather you just enjoyed yourself heheh), tick off your training tasks each week, and archive daily accomplishments.
            </div>
            
            {/* dynamic week count banner */}
            <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-brand-plum-deep text-[11px] font-bold border border-brand-gold/25 text-brand-gold tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                {getCurrentWeekText()}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-brand-plum-deep text-[11px] font-bold border border-brand-rose/25 text-brand-rose tracking-wide flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-brand-rose" />
                {getOverallPercentage() === 100 ? "Quest Complete!" : `${getOverallPercentage()}% Finished`}
              </span>
            </div>
          </div>

          {/* CIRCULAR PROGRESS RING */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="58"
                  className="stroke-brand-plum-light"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="58"
                  className="stroke-brand-gold transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 58}
                  strokeDashoffset={2 * Math.PI * 58 * (1 - getOverallPercentage() / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-serif font-black text-brand-cream leading-none">{getOverallPercentage()}%</span>
                <span className="text-[9px] uppercase tracking-widest text-brand-cream/60 mt-0.5">COMPLETED</span>
              </div>
            </div>
            {getMotivationalText(getOverallPercentage()) && (
              <p className="text-xs text-brand-rose font-medium mt-1 font-serif text-center max-w-[170px] italic">
                "{getMotivationalText(getOverallPercentage())}"
              </p>
            )}
          </div>
        </section>

        {/* DAILY TIP PRE-FLIGHT NOTIFICATION DRAWER & REMINDER CONTROLS */}
        <section id="tip_and_setup_panel" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* DAILY ROTATING CREATIVE GUIDELINE CARD */}
          <div className="plum-glass rounded-2xl p-5 border-l-4 border-l-brand-gold flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand-gold/15 text-brand-gold">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" className="w-5 h-5 fill-current"><path d="M292.9 384c7.3-22.3 21.9-42.5 38.4-59.9 32.7-34.4 52.7-80.9 52.7-132.1 0-106-86-192-192-192S0 86 0 192c0 51.2 20 97.7 52.7 132.1 16.5 17.4 31.2 37.6 38.4 59.9l201.7 0zM288 432l-192 0 0 16c0 44.2 35.8 80 80 80l32 0c44.2 0 80-35.8 80-80l0-16zM184 112c-39.8 0-72 32.2-72 72 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-66.3 53.7-120 120-120 13.3 0 24 10.7 24 24s-10.7 24-24 24z"/></svg>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-brand-gold leading-none">Toheerah's Daily Editor Tip</span>
                <p className="text-sm font-medium tracking-wide text-brand-cream leading-relaxed mt-1">{randomTip}</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                const next = INSIGHTS_ARRAY[Math.floor(Math.random() * INSIGHTS_ARRAY.length)];
                setRandomTip(next);
              }}
              className="self-end text-[11px] text-brand-gold font-bold hover:underline py-1 px-3 rounded-md bg-brand-gold/5 transition flex items-center gap-1"
            >
              Next &rarr;
            </button>
          </div>

          {/* NOTIFICATION SETTINGS COMPONENT */}
          <div className="plum-glass rounded-2xl p-5 border-l-4 border-l-brand-rose flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand-rose/15 text-brand-rose">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black tracking-widest text-brand-rose leading-none">Calendar & Reminders</span>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${remindersEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-cream/10 text-brand-cream/60'}`}>
                    {remindersEnabled ? "Reminders Set ✓" : "Notifications Pending"}
                  </span>
                </div>
                
                <p className="text-xs text-brand-cream/70 mt-1">Configured to build focus sessions for Toheerah's MacBook routine:</p>
                
                {/* Day Selectors */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                    const isSelected = reminderDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          const nextDays = isSelected
                            ? reminderDays.filter(d => d !== day)
                            : [...reminderDays, day];
                          syncReminderConfig(nextDays, reminderTime, remindersEnabled);
                        }}
                        className={`text-[10px] font-bold w-7 h-7 rounded-lg transition flex items-center justify-center border ${isSelected ? 'bg-brand-rose text-brand-cream border-brand-rose' : 'bg-brand-plum-deep hover:bg-brand-plum-light text-brand-cream/50 border-brand-rose/10'}`}
                      >
                        {day[0]}
                      </button>
                    );
                  })}
                </div>

                {/* Time setup selector */}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-brand-cream/60 font-serif">Daily Alert:</span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => syncReminderConfig(reminderDays, e.target.value, remindersEnabled)}
                    className="bg-brand-plum-deep border border-brand-rose/20 rounded-md py-1 px-2 text-xs text-brand-gold font-bold focus:outline-none focus:ring-1 focus:ring-brand-gold text-center w-24"
                  />
                </div>

                <div className="mt-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-brand-cream leading-none">Delivery Method</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => syncReminderConfig(reminderDays, reminderTime, remindersEnabled, 'browser')}
                      className={`text-[11px] font-bold py-2 rounded-lg transition ${reminderChannel === 'browser' ? 'bg-emerald-500 text-black' : 'bg-brand-plum-deep text-brand-cream border border-brand-rose/10'}`}
                    >
                      Browser
                    </button>
                    <button
                      onClick={() => syncReminderConfig(reminderDays, reminderTime, remindersEnabled, 'email')}
                      className={`text-[11px] font-bold py-2 rounded-lg transition ${reminderChannel === 'email' ? 'bg-emerald-500 text-black' : 'bg-brand-plum-deep text-brand-cream border border-brand-rose/10'}`}
                    >
                      Email
                    </button>
                  </div>
                  {reminderChannel === 'email' && (
                    <p className="text-[11px] text-brand-cream/70 mt-2">
                      Reminder emails will be sent to <span className="text-brand-gold">{user?.email ?? 'your Google email'}</span>.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={requestNotificationPermission}
              className="w-full text-center py-1.5 bg-brand-rose/20 hover:bg-brand-rose/30 text-brand-rose border border-brand-rose/30 text-xs font-bold rounded-lg transition mt-2 flex items-center justify-center gap-1"
            >
              <span>{remindersEnabled ? "Update Reminder Settings" : "Enable Reminders Setup"}</span>
            </button>
            {reminderChannel === 'email' && (
              <button
                onClick={sendReminderEmail}
                className="w-full text-center py-1.5 bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold border border-brand-gold/30 text-xs font-bold rounded-lg transition mt-2"
              >
                Send Reminder Email Now
              </button>
            )}
            {emailSendStatus && (
              <p className="text-[11px] text-emerald-300 mt-2">{emailSendStatus}</p>
            )}
          </div>
        </section>

        {/* WORKSPACE PRE-FLIGHT HARDWARE BOOTSTRAPPING CHECKLIST */}
        <section id="setup_section" className="plum-glass rounded-2xl p-6 border border-brand-rose/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-brand-rose/10 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-serif text-brand-cream font-bold">1. Hardware & App Setup checklist</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold text-xs font-black">
                {getSetupCompletionCount()}/8 Complete
              </span>
            </div>
            <span className="text-xs text-brand-cream/60">Do these before starting Week 1</span>
          </div>

          {/* TWO COLUMNS OF DOWNLOAD LINKS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            
            {/* Phone Apps card */}
            <div className="bg-brand-plum-deep/55 border border-brand-rose/10 rounded-xl p-4 flex flex-col gap-3">
              <span className="text-xs uppercase font-extrabold text-brand-rose tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" /> Mobile phone Apps
              </span>
              
              <div className="flex flex-col gap-3 mt-1 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-brand-rose/5 pb-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-extrabold">CapCut Mobile</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-green-500/10 text-green-400 border border-green-500/25 px-1.5 rounded-sm">Free</span>
                    </div>
                    <span className="text-xs text-brand-cream/60 mt-0.5">The ultimate multi-track vertical tool, perfect for speed, transitions, and automated captions.</span>
                  </div>
                  <a href="https://www.capcut.com" target="_blank" rel="noreferrer" className="text-brand-gold hover:underline shrink-0 text-xs flex items-center gap-1">
                    Download <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-brand-rose/5 pb-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-extrabold">VN Editor</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-brand-rose/10 text-brand-rose border border-brand-rose/25 px-1.5 rounded-sm">Freemium</span>
                    </div>
                    <span className="text-xs text-brand-cream/60 mt-0.5">Clean interface with no watermarks. Excellent keyframe velocity charts and subtitle curves.</span>
                  </div>
                  <a href="https://vlognow.me/" target="_blank" rel="noreferrer" className="text-brand-gold hover:underline shrink-0 text-xs flex items-center gap-1">
                    Download <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-extrabold">InShot</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-brand-rose/10 text-brand-rose border border-brand-rose/25 px-1.5 rounded-sm">Freemium</span>
                    </div>
                    <span className="text-xs text-brand-cream/60 mt-0.5">Very beginner friendly for fast aspect ratio resizing and adding simple local sound effects.</span>
                  </div>
                  <a href="https://inshot.com" target="_blank" rel="noreferrer" className="text-brand-gold hover:underline shrink-0 text-xs flex items-center gap-1">
                    Download <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* PC Software card */}
            <div className="bg-brand-plum-deep/55 border border-brand-rose/10 rounded-xl p-4 flex flex-col gap-3">
              <span className="text-xs uppercase font-extrabold text-brand-gold tracking-wider flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" /> Mac Software
              </span>
              
              <div className="flex flex-col gap-3 mt-1 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-brand-rose/5 pb-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-extrabold">DaVinci Resolve</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-green-500/10 text-green-400 border border-green-500/25 px-1.5 rounded-sm">Free</span>
                    </div>
                    <span className="text-xs text-brand-cream/60 mt-0.5">Industry standard professional software. Incredible color page grading tools and fairlight audio tabs.</span>
                  </div>
                  <a href="https://www.blackmagicdesign.com/products/davinciresolve" target="_blank" rel="noreferrer" className="text-brand-gold hover:underline shrink-0 text-xs flex items-center gap-1">
                    Download <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-brand-rose/5 pb-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-extrabold">Canva Web Video</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-green-500/10 text-green-400 border border-green-500/25 px-1.5 rounded-sm">Free</span>
                    </div>
                    <span className="text-xs text-brand-cream/60 mt-0.5">Online editing board perfect for structuring layouts, animated YouTube intros, and video titles.</span>
                  </div>
                  <a href="https://www.canva.com/video-editor/" target="_blank" rel="noreferrer" className="text-brand-gold hover:underline shrink-0 text-xs flex items-center gap-1">
                    Open Web <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-extrabold">Adobe Premiere Pro</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 px-1.5 rounded-sm">Paid</span>
                    </div>
                    <span className="text-xs text-brand-cream/60 mt-0.5">Highly integrated cloud suite. Optional upgrade path later once you learn multi-track MacBook timelines.</span>
                  </div>
                  <span className="text-xs text-brand-cream/40 px-2 font-serif italic">Optional</span>
                </div>
              </div>
            </div>
          </div>

          {/* SETUP ACTIONABLE CHECKBOX LIST */}
          <div className="mt-6 border-t border-brand-rose/10 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRE_FLIGHT_SETUP.map(item => {
              const isChecked = !!checkedTasks[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => handleTaskToggle(item.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition cursor-pointer select-none ${isChecked ? 'bg-brand-rose/10 border-brand-rose/30 text-brand-cream/80' : 'bg-brand-plum-deep/40 border-brand-rose/5 hover:border-brand-rose/20 text-brand-cream/90'}`}
                >
                  <button className="shrink-0 mt-0.5 text-brand-gold">
                    {isChecked ? (
                      <CheckCircle2 className="w-4 h-4 text-brand-rose fill-brand-rose/10" />
                    ) : (
                      <Circle className="w-4 h-4 text-brand-rose/50" />
                    )}
                  </button>
                  <span className={`text-[12px] leading-tight font-medium ${isChecked ? 'line-through opacity-60' : ''}`}>{item.text}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* WORKSPACE VIEW SWITCH TABS (TIMELINE CHECKS VS TOOLBOX VS JOURNAL LOGS) */}
        <section id="workshop_tab_picker" className="flex items-center justify-center p-1 rounded-xl bg-brand-plum-deep/80 border border-brand-rose/10 scale-100">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-serif text-sm tracking-wide font-black transition ${activeTab === 'timeline' ? 'bg-brand-rose text-white shadow-md animate-success-pop' : 'text-brand-cream/75 hover:text-brand-cream hover:bg-brand-plum-light/35'}`}
          >
            <Video className="w-4 h-4" />
            <span>Timeline checklist</span>
          </button>
          
          <button
            onClick={() => setActiveTab('toolbox')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-serif text-sm tracking-wide font-black transition ${activeTab === 'toolbox' ? 'bg-brand-rose text-white shadow-md animate-success-pop' : 'text-brand-cream/75 hover:text-brand-cream hover:bg-brand-plum-light/35'}`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Toheerah's Toolbox</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-serif text-sm tracking-wide font-black transition ${activeTab === 'journal' ? 'bg-brand-rose text-white shadow-md animate-success-pop' : 'text-brand-cream/75 hover:text-brand-cream hover:bg-brand-plum-light/35'}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Journal Ledger</span>
          </button>
        </section>

        {/* TAB TARGET SELECTIONS RENDERING */}
        <section id="tab_container" className="space-y-6">
          
          {/* TAB 1: INTERACTIVE WEEK TIMELINE CHECKLIST */}
          {activeTab === 'timeline' && (
            <div className="flex flex-col gap-6">
              
              {/* month 1 block banner */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-px bg-brand-rose/25 flex-grow" />
                  <span className="font-serif font-black text-xs uppercase tracking-widest text-brand-gold gold-glow">Phase 1 — Month 1: Foundation Timeline</span>
                  <div className="h-px bg-brand-rose/25 flex-grow" />
                </div>
                
                <div className="grid grid-cols-1 gap-4 mt-2">
                  {WEEKS_DATA.slice(0, 4).map((week) => renderWeekCard(week))}
                </div>
              </div>

              {/* month 2 block banner */}
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex items-center gap-3">
                  <div className="h-px bg-brand-rose/25 flex-grow" />
                  <span className="font-serif font-black text-xs uppercase tracking-widest text-brand-gold gold-glow font-serif">Phase 2 — Month 2: Intermediate Timeline</span>
                  <div className="h-px bg-brand-rose/25 flex-grow" />
                </div>
                
                <div className="grid grid-cols-1 gap-4 mt-2">
                  {WEEKS_DATA.slice(4, 8).map((week) => renderWeekCard(week))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TOHEERAH'S TOOLBOX (RESOURCES HUB) */}
          {activeTab === 'toolbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Category card 1: royalty-free music */}
              <div className="plum-glass rounded-xl p-5 border-t-2 border-t-brand-gold flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-gold">
                  <Music className="w-5 h-5 animate-pulse" />
                  <span className="font-serif font-bold text-base text-brand-cream">🎵 Free Music Resources</span>
                </div>
                <p className="text-xs text-brand-cream/60">Copyright-safe backing tracks customized for social media edits and portfolios:</p>
                
                <div className="flex flex-col gap-2.5 mt-2 text-sm">
                  <a href="https://www.youtube.com/audiolibrary" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">YouTube Audio Library</p>
                      <p className="text-[10px] text-brand-cream/40">Pure built-in creator dashboard download</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://www.epidemicsound.com" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Epidemic Sound Free Trial</p>
                      <p className="text-[10px] text-brand-cream/40">The pristine elite industry standard standard audio creator</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://pixabay.com/music/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Pixabay Music</p>
                      <p className="text-[10px] text-brand-cream/40">Zero register click downloads perfect for draft edits</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://www.bensound.com" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Bensound Music</p>
                      <p className="text-[10px] text-brand-cream/40">Epic cinematic and acoustic royalty tracks</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Category card 2: LUTs & color matching presets */}
              <div className="plum-glass rounded-xl p-5 border-t-2 border-t-brand-gold flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-gold">
                  <span className="font-serif font-bold text-base text-brand-cream">🎨 LUTs & Presets</span>
                </div>
                <p className="text-xs text-brand-cream/60">Creative Lookup Tables (LUTs) to apply instant warm grading styles in DaVinci Resolve:</p>
                
                <div className="flex flex-col gap-2.5 mt-2 text-sm">
                  <a href="https://luts.iwltbap.com" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">iwltbap Free LUT utility</p>
                      <p className="text-[10px] text-brand-cream/40">Clean cinematic teal-and-orange coloring files</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://groundcontrolcolor.com" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Ground Control LUT packs</p>
                      <p className="text-[10px] text-brand-cream/40">Pro camera LUT correction values for log profiles</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://motionarray.com/learn/davinci-resolve/free-davinci-resolve-luts/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Motion Array Free Resolves</p>
                      <p className="text-[10px] text-brand-cream/40">20+ stylized presets ideal for film aesthetics</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Category card 3: stock raw footage */}
              <div className="plum-glass rounded-xl p-5 border-t-2 border-t-brand-gold flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-gold">
                  <Video className="w-5 h-5" />
                  <span className="font-serif font-bold text-base text-brand-cream">🖼️ Royalty Stock Footage</span>
                </div>
                <p className="text-xs text-brand-cream/60">B-roll footage and high-definition elements to stitch and composite into sequences:</p>
                
                <div className="flex flex-col gap-2.5 mt-2 text-sm">
                  <a href="https://www.pexels.com/videos/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Pexels Free Stock</p>
                      <p className="text-[10px] text-brand-cream/40">Highly stylized beautiful vertical aesthetic videos</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://pixabay.com/videos/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Pixabay Stock Tracks</p>
                      <p className="text-[10px] text-brand-cream/40">Wide landscape captures, slow motion shots, drone b-roll</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://coverr.co" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Coverr Virtual stocks</p>
                      <p className="text-[10px] text-brand-cream/40">Top choice loop frames and cinematic workspace background grids</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Category card 4: sound effects audio library */}
              <div className="plum-glass rounded-xl p-5 border-t-2 border-t-brand-rose flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-rose">
                  <Bell className="w-5 h-5" />
                  <span className="font-serif font-bold text-base text-brand-cream">🔊 Dynamic SFX libraries</span>
                </div>
                <p className="text-xs text-brand-cream/60">Swooshes, background ambiance, pop clicks, and sub-impact sound files:</p>
                
                <div className="flex flex-col gap-2.5 mt-2 text-sm">
                  <a href="https://freesound.org" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Freesound.org database</p>
                      <p className="text-[10px] text-brand-cream/40">Pristine community record audio elements</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://mixkit.co/free-sound-effects/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Mixkit sound library effects</p>
                      <p className="text-[10px] text-brand-cream/40">Game pops, interface sound sliders, movie swooshes</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Category card 5: graphic designs / canva */}
              <div className="plum-glass rounded-xl p-5 border-t-2 border-t-brand-rose flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-rose">
                  <Laptop className="w-5 h-5 animate-pulse" />
                  <span className="font-serif font-bold text-base text-brand-cream">📐 Canva Graphics templates</span>
                </div>
                <p className="text-xs text-brand-cream/60">Generate clicking titles, personal intro templates, lower third designs, and custom thumbs:</p>
                
                <div className="flex flex-col gap-2.5 mt-2 text-sm">
                  <a href="https://www.canva.com/video-templates/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Canva Video layout Canvas</p>
                      <p className="text-[10px] text-brand-cream/40">Ready animation title templates for online designers</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <a href="https://www.canva.com/create/youtube-thumbnails/" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">YouTube Thumbnail Creator</p>
                      <p className="text-[10px] text-brand-cream/40">Pro graphic layouts, font sets, outline filters</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Category card 6: cheat sheets & resolution manuals */}
              <div className="plum-glass rounded-xl p-5 border-t-2 border-t-brand-rose flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-rose">
                  <BookOpen className="w-5 h-5" />
                  <span className="font-serif font-bold text-base text-brand-cream">📚 Quick Cheat Sheets</span>
                </div>
                <p className="text-xs text-brand-cream/60">Downloadable DaVinci key shortcuts and resolution guides for mobile footage calibrations:</p>
                
                <div className="flex flex-col gap-2.5 mt-2 text-sm">
                  <a href="https://www.blackmagicdesign.com/products/davinciresolve" target="_blank" rel="noreferrer" className="flex justify-between items-center bg-brand-plum-deep/40 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/20 hover:text-brand-gold transition leading-tight">
                    <div>
                      <p className="font-bold text-xs">Resolve Shortcuts PDF manual</p>
                      <p className="text-[10px] text-brand-cream/40">Blackmagic official keyboard reference sheet</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: TOHEERAH'S LEARNING JOURNAL HISTORY TIMELINE */}
          {activeTab === 'journal' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-serif font-bold">Toheerah's Writing Lounge</h3>
                  <p className="text-xs text-brand-cream/60">Reflect on milestones, document bugs, rate emotions, and capture your timeline history.</p>
                </div>
                
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="px-4 py-2 bg-brand-gold hover:bg-brand-gold/80 text-brand-plum-deep text-xs font-extrabold rounded-lg flex items-center gap-2 shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log check-in progress</span>
                </button>
              </div>

              {/* render lists */}
              <div className="space-y-4 mt-4">
                {journalLogs.length === 0 ? (
                  <div className="plum-glass rounded-2xl p-8 text-center text-brand-cream/50 max-w-md mx-auto flex flex-col items-center gap-3">
                    <span className="text-4xl">📝</span>
                    <p className="font-serif text-sm">No notes cataloged yet. Start logging your progress using the check-in modal to track your mental gains!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {journalLogs.map((log) => (
                      <div key={log.id} className="plum-glass rounded-xl p-5 border-l-4 border-l-brand-rose relative flex flex-col gap-2 hover:translate-x-1.5 duration-300">
                        {/* deletes */}
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="absolute top-4 right-4 text-brand-cream/40 hover:text-red-400 p-1 rounded-md transition"
                          title="Erase Note"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        
                        <div className="flex items-center gap-4 text-xs">
                          <span className="bg-brand-rose/20 text-brand-rose px-2.5 py-0.5 rounded-full font-serif font-black">
                            Week {log.weekIndex}
                          </span>
                          <span className="text-brand-gold border border-brand-gold/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-brand-gold/5">
                            Mood Index: <span className="text-sm leading-none">{log.feeling}</span>
                          </span>
                          <span className="text-brand-cream/50">{new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        
                        <p className="text-sm font-medium leading-relaxed font-serif text-brand-cream/90 mt-1 whitespace-pre-line pr-6">
                          "{log.note}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </section>

      </main>

      {/* MOTIVATIONAL FOOTER CONSOLE */}
      <footer id="quest_footer" className="relative z-10 border-t border-brand-rose/10 bg-brand-plum-deep/80 py-8 px-4 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 text-center">
          
          {/* edit quote banner */}
          <div className="max-w-lg">
            <span className="text-brand-gold/50 text-[10px] uppercase tracking-widest font-black">A creator once said this</span>
            <p className="text-sm italic font-serif text-brand-cream/80 leading-relaxed mt-1">
              "An edit is ready when it makes you laugh, cry, or sit upright in tension. Follow your gut, Toheerah. The pacing is already in your blood."
            </p>
            <span className="text-xs text-brand-rose/85 block mt-1">— Peter McKinnon, Creator</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-xs text-brand-cream/50 mt-2">
            <span>For Toheerah</span>
            <span className="hidden sm:inline">•</span>
            <span>Progress: {WEEKS_DATA.filter(w => isWeekComplete(w.id)).length} of 8 Weeks Conquered</span>
            <span className="hidden sm:inline">•</span>
            <span>Overall Score: {getOverallPercentage()}% finished</span>
          </div>
        </div>
      </footer>

      {/* FLOAT STICKY MOBILE CHECK-IN LOGGER DIALOG TRIGGER */}
      <div className="fixed bottom-24 right-6 z-40">
        <button
          onClick={() => setShowCheckInModal(true)}
          className="flex items-center gap-2 bg-brand-rose hover:bg-brand-rose/90 hover:scale-105 active:scale-95 duration-200 text-white font-bold py-3.5 px-6 rounded-full shadow-2xl card-gold-glow cursor-pointer relative"
        >
          <Plus className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-serif">Log Today's Progress</span>
        </button>
      </div>

      {/* WELCOME FIRST-TIME ONBOARDING VISITOR MODAL INTERACTIVE BOX */}
      {!hasVisited && (
        <div className="fixed inset-0 z-50 bg-brand-plum-deep/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="plum-glass text-center rounded-3xl p-6 sm:p-10 max-w-lg w-full flex flex-col items-center gap-6 border-2 border-brand-rose shadow-2xl relative animate-float-slow">
            <div className="absolute -top-10 text-6xl">🎬</div>
            
            <h2 className="text-3xl font-serif font-black text-brand-gold gold-glow mt-4 leading-tight">
              Hi Toheerah! 👋
            </h2>
            
            <p className="text-sm text-brand-cream/90 leading-relaxed font-serif">
              This is your personal video editing journey. Jesse and I designed this 8-week timeline space explicitly for you so you can transition from absolute beginner to production video designer using your smartphone, MacBook, and simple templates (Hopefully, your boyfriend can be a little over expectant, just enjoy yourself, really).
            </p>

            <div className="bg-brand-plum-deep/60 p-4 rounded-xl border border-brand-rose/25 text-left w-full">
              <span className="text-[10px] text-brand-gold font-extrabold uppercase tracking-wider block">TRAINING PREPARATION:</span>
              <p className="text-xs text-brand-cream/80 leading-normal mt-1">
                All checkbox ticks, customized reminder times, journal pages, and emotional history logs sync directly with your private session. Let's get started!
              </p>
            </div>

            <button
              onClick={() => {
                syncHasVisitedState(true);
                triggerConfetti();
                showToast("Welcome aboard Toheerah! Let's conquer video design together!");
              }}
              className="w-full text-center py-3.5 bg-brand-rose hover:bg-brand-rose/90 border border-brand-rose/40 text-white font-serif font-bold rounded-xl text-md transition uppercase tracking-wider cursor-pointer"
            >
              Let's Go! 🎬
            </button>
          </div>
        </div>
      )}

      {/* BACKDROP AND MODAL CONTAINER LAYER FOR LOG CHECK-IN */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="plum-glass rounded-2xl p-6 max-w-md w-full border border-brand-rose/40 shadow-2xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-brand-rose/10 pb-3">
              <span className="text-lg font-serif font-extrabold text-brand-cream">📝 Log Toheerah's Daily Wins</span>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-brand-cream/60 hover:text-brand-cream p-1 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCheckIn} className="flex flex-col gap-4 mt-2">
              
              {/* Select target week number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-rose font-bold uppercase tracking-wider block">Target Training Week:</label>
                <select
                  value={checkInWeek}
                  onChange={(e) => setCheckInWeek(Number(e.target.value))}
                  className="bg-brand-plum-deep text-brand-cream font-serif text-sm border border-brand-rose/20 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  {WEEKS_DATA.map(w => (
                    <option key={w.id} value={w.id}>
                      Week {w.id}: {w.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* emotion feel parameters */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-rose font-bold uppercase tracking-wider block">My Current Vibes:</label>
                <div className="flex items-center justify-between bg-brand-plum-deep p-2 border border-brand-rose/10 rounded-lg gap-2">
                  {[
                    { e: '🥲', text: "I'm about to cry" },
                    { e: '😐', text: 'Mehh' },
                    { e: '😌', text: 'Hehehe' },
                    { e: '🔥', text: 'Swinging from the chandaliiieeerrrr' }
                  ].map(item => {
                    const isSelected = checkInFeeling === item.text;
                    return (
                      <button
                        type="button"
                        key={item.text}
                        onClick={() => setCheckInFeeling(item.text)}
                        className={`flex-1 flex flex-col items-center p-2 rounded-md transition cursor-pointer ${isSelected ? 'bg-brand-rose/25 border border-brand-rose/45 text-brand-cream' : 'bg-transparent text-brand-cream/55 hover:bg-brand-cream/5 hover:text-brand-cream'}`}
                      >
                        <span className="text-xl leading-none">{item.e}</span>
                        <span className="text-[9px] mt-1 tracking-tight text-center leading-tight">{item.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* textual note reflection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-rose font-bold uppercase tracking-wider block">Training Notes (Reflections/Bugs):</label>
                <textarea
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  placeholder="e.g. Edited my first CapCut timeline! Synced transitions flawlessly to music!"
                  rows={4}
                  required
                  className="bg-brand-plum-deep border border-brand-rose/20 rounded-lg p-2.5 text-xs text-brand-cream focus:outline-none focus:ring-1 focus:ring-brand-gold placeholder:text-brand-cream/35 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 border-t border-brand-rose/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-4 py-2 bg-brand-plum-light text-brand-cream hover:bg-brand-plum border border-brand-rose/10 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-gold text-brand-plum-deep font-extrabold rounded-lg text-xs hover:bg-brand-gold/80 transition shadow"
                >
                  Save Wins Ledger
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MILESTONE CELEBRATION DISCOVER CARD POPUP MODAL */}
      {milestonePopup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="plum-glass rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center border-2 border-brand-gold shadow-2xl relative flex flex-col items-center gap-5">
            <span className="text-5xl animate-bounce">🏆</span>
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setMilestonePopup(null)}
                className="text-brand-cream/50 hover:text-brand-cream font-bold p-1 transition"
                title="Dismiss details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-black text-brand-gold tracking-widest pl-1">WEEK COMPLETE CELEBRATION!</span>
              <h3 className="text-3xl font-serif font-black text-brand-cream leading-tight">
                Toheerah, you have conquered Week {milestonePopup.id}!
              </h3>
              <p className="text-brand-rose text-sm italic font-serif mt-0.5">"{milestonePopup.title}"</p>
            </div>

            {/* shareable visual showcase card details */}
            <div className="bg-brand-plum-deep/80 p-5 rounded-2xl border border-brand-rose/20 text-left w-full flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-brand-gold/5 rounded-bl-full pointer-events-none" />
              <div className="flex items-center gap-2 text-brand-gold">
                <span className="text-[10px] uppercase font-bold tracking-wider">SHAREABLE GRADUATION QUOTE:</span>
              </div>
              <p className="text-base font-serif italic text-brand-cream/90 leading-normal">
                "{milestonePopup.project.quote}"
              </p>
              
              <div className="border-t border-brand-rose/5 pt-3 mt-1">
                <span className="text-[10px] text-brand-rose font-bold uppercase tracking-wider block">Active Week Highlight Assignment:</span>
                <p className="text-xs text-brand-cream/80 font-medium leading-relaxed mt-0.5 bg-brand-pearl/5 p-2 rounded border border-brand-rose/10">
                  {milestonePopup.project.prompt}
                </p>
              </div>
            </div>

            <button
              onClick={() => setMilestonePopup(null)}
              className="w-full text-center py-3 bg-brand-gold hover:bg-brand-gold/80 text-brand-plum-deep font-bold font-serif rounded-xl text-sm transition tracking-wider uppercase"
            >
              Conquer Next Milestone 🚀
            </button>
          </div>
        </div>
      )}

      {/* MONTH 1 DOUBLE-STAGE GOLDEN MAJOR CELEBRATION OVERLAY */}
      {showMonth1Celebration && (
        <div className="fixed inset-0 z-55 bg-brand-plum-deep/95 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="max-w-xl w-full text-center flex flex-col items-center gap-6 p-8 rounded-3xl border-2 border-brand-gold bg-brand-plum relative card-gold-glow animate-float-slow">
            <span className="text-7xl animate-bounce">🌻🎉</span>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-brand-gold tracking-widest pl-1 leading-none">MAJOR QUEST MILESTONE MET</span>
              <h2 className="text-4xl font-serif font-black text-brand-cream">
                You've Completed Month 1, Toheerah! 🎉
              </h2>
              <p className="text-brand-rose text-[15px] font-semibold italic font-serif">"The Foundations have been officially Conquered!"</p>
            </div>

            <div className="text-sm text-brand-cream/80 max-w-md leading-relaxed">
              You climbed from zero to desktop editing across CapCut, keyframes, transitions, timeline pacing, and sound balance. Month 2 color-grading grading scopes and raw master portfolios await!
            </div>

            <div className="bg-brand-plum-deep/80 p-5 rounded-2xl border border-brand-gold/20 text-left w-full flex flex-col gap-3 relative">
              <div className="flex items-center gap-2 text-brand-gold">
                <Award className="w-5 h-5 text-brand-gold animate-bounce" />
                <span className="text-xs font-black tracking-wider">MONTH 1 COMPLETED VERBAL TRANSCRIPT:</span>
              </div>
              <p className="text-xs text-brand-cream/70 leading-relaxed italic">
                "Video editing isn't merely cutting frames. It is writing narrative compositions with light and music. You have earned your formal Foundations Diploma Badge, Toheerah. Stay curious!"
              </p>
            </div>

            <button
              onClick={() => {
                setShowMonth1Celebration(false);
                triggerConfetti();
              }}
              className="w-full text-center py-4 bg-brand-gold hover:bg-brand-gold/85 text-brand-plum-deep font-bold font-serif rounded-xl text-sm transition tracking-wider uppercase shadow-xl"
            >
              Claim Graduation Shield & Continue &rarr;
            </button>
          </div>
        </div>
      )}

      {/* FLOATING ACTION AI COMPANION AGENT BUBBLE ICON */}
      <div className="fixed bottom-6 right-6 z-55 flex flex-col items-end">
        
        {/* Expanded Chat Assistant Drawer Card Container */}
        {isChatOpen && (
          <div className="w-96 max-w-[calc(100vw-32px)] h-[520px] max-h-[80vh] bg-brand-plum border-2 border-brand-rose/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 animate-success-pop">
            
            {/* Header section with avatar */}
            <div className="bg-brand-plum-deep/85 px-4 py-3.5 border-b border-brand-rose/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <img
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQr3RbJfIEQt7EvZIHeTMiHbiV6P7nwOIv_XgEkdp6wpw&s=10"
                    alt="AI assistant icon"
                    className="w-8 h-8 object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-serif font-black tracking-wide text-brand-cream">Chomi</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-brand-gold font-bold uppercase tracking-widest pl-0.5">Active. Tired.</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-brand-cream/45 hover:text-brand-rose p-1 transition"
                title="Minimize panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat conversation container logs */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-brand-plum-deep/20 scrollbar-thin">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed transition font-serif ${
                      msg.role === 'user'
                        ? 'bg-brand-rose/20 text-brand-cream rounded-tr-xs border border-brand-rose/30'
                        : 'bg-brand-plum-deep text-brand-cream/90 rounded-tl-xs border border-brand-rose/10'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-brand-cream/35 mt-1 font-sans">
                    {msg.role === 'user' ? 'Toheerah' : 'Bot 1.0'}
                  </span>
                </div>
              ))}

              {isChatLoading && (
                <div className="self-start flex flex-col items-start max-w-[85%]">
                  <div className="px-3.5 py-2.5 bg-brand-plum-deep text-brand-cream/60 rounded-2xl rounded-tl-xs border border-brand-rose/10 text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-rose animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-rose animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-rose animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Suggeted presets shortcuts */}
            <div className="bg-brand-plum-deep/40 px-3 py-2 border-t border-brand-rose/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => handleSendChatMessage("Give me DaVinci shortcuts for MacBook!")}
                disabled={isChatLoading}
                className="px-2.5 py-1 text-[10px] font-serif bg-brand-plum border border-brand-rose/10 hover:border-brand-rose/30 hover:text-brand-gold transition duration-200 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-40"
              >
                💻 Mac Shortcuts
              </button>
              <button
                type="button"
                onClick={() => handleSendChatMessage("Tips for Week 3 Basics project")}
                disabled={isChatLoading}
                className="px-2.5 py-1 text-[10px] font-serif bg-brand-plum border border-brand-rose/10 hover:border-brand-rose/30 hover:text-brand-gold transition duration-200 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-40"
              >
                🎬 Week 3 Tips
              </button>
              <button
                type="button"
                onClick={() => handleSendChatMessage("How to organize folders on Mac?")}
                disabled={isChatLoading}
                className="px-2.5 py-1 text-[10px] font-serif bg-brand-plum border border-brand-rose/10 hover:border-brand-rose/30 hover:text-brand-gold transition duration-200 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-40"
              >
                📁 Folder Layout
              </button>
            </div>

            {/* Input form element panel */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="p-3 bg-brand-plum-deep border-t border-brand-rose/15 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInputValue}
                onChange={(e) => setChatInputValue(e.target.value)}
                disabled={isChatLoading}
                placeholder="Ask away, slavedriver......"
                className="flex-1 bg-brand-plum border border-brand-rose/15 focus:border-brand-rose/45 rounded-xl px-3.5 py-2 text-xs text-brand-cream placeholder-brand-cream/35 focus:outline-none transition font-serif focus:ring-1 focus:ring-brand-rose/20 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInputValue.trim()}
                className="p-2.5 bg-brand-rose hover:bg-brand-rose/85 text-brand-cream rounded-xl disabled:opacity-30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 text-xs flex items-center justify-center shadow-lg"
                title="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </div>
        )}

        {/* Floating Bubble Circle Trigger Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative flex items-center justify-center bg-transparent text-brand-cream w-14 h-14 rounded-full transition duration-300 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer animate-pulse shadow-[0_0_24px_rgba(255,215,145,0.35)]"
          title={isChatOpen ? "Close AI Companion" : "Open Toheerah's Video Companion Agent"}
        >
          <span className="absolute inset-0 rounded-full bg-brand-gold/20 opacity-35 blur-xl animate-ping" />
          <span className="absolute inset-0 rounded-full bg-brand-gold/10 opacity-30 animate-pulse" />
          {isChatOpen ? (
            <X className="w-5 h-5 relative z-10 transition duration-200 animate-success-pop" />
          ) : (
            <div className="relative flex items-center justify-center">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQr3RbJfIEQt7EvZIHeTMiHbiV6P7nwOIv_XgEkdp6wpw&s=10"
                alt="AI assistant icon"
                className="w-6 h-6 rounded-full relative z-10 object-cover"
              />
            </div>
          )}
        </button>

      </div>

    </div>
  );

  // Helper toggle task completed items
  function handleTaskToggle(taskId: string, weekId?: number) {
    handleTaskCheckToggle(taskId, weekId);
  }

  // Visual helper generator of Timeline Week Accordions
  function renderWeekCard(week: typeof WEEKS_DATA[0]) {
    const isExpanded = expandedWeek === week.id;
    const completedTasks = getWeekCompletionCount(week.id);
    const totalWeekTasks = week.tasks.length;
    const isCompleted = isWeekComplete(week.id);

    return (
      <div
        key={week.id}
        className={`rounded-2xl border transition duration-300 ${isCompleted ? 'bg-brand-plum/10 border-brand-rose/40 shadow-inner' : 'bg-brand-plum/40 border-brand-rose/10 hover:border-brand-rose/25 shadow-md hover:shadow-lg'}`}
      >
        {/* week accordion headers */}
        <div
          onClick={() => setExpandedWeek(isExpanded ? null : week.id)}
          className="flex items-center justify-between p-5 cursor-pointer leading-tight select-none"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="font-serif font-black text-xs text-brand-rose">WEEK {week.id}</span>
              {isCompleted ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] uppercase font-black tracking-wide shrink-0 animate-pulse">
                  ✓ Beautifully Complete
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-brand-plum-deep border border-brand-rose/15 text-brand-cream/50 text-[10px] shrink-0 font-serif font-bold">
                  {completedTasks}/{totalWeekTasks} Tasks
                </span>
              )}
            </div>
            
            <h4 className="text-base font-serif font-black tracking-wide text-brand-cream font-bold">
              {week.title}
            </h4>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-block text-[10px] text-brand-rose/70 bg-brand-rose/10 border border-brand-rose/20 rounded-md py-0.5 px-2">
              {week.timeEstimate}
            </span>
            {isExpanded ? <ChevronUp className="w-5 h-5 text-brand-rose" /> : <ChevronDown className="w-5 h-5 text-brand-rose" />}
          </div>
        </div>

        {/* accordion expanded timelines */}
        {isExpanded && (
          <div className="px-5 pb-5 border-t border-brand-rose/5 pt-4 flex flex-col gap-5 bg-brand-plum-deep/20 rounded-b-2xl animate-success-pop">
            
            <p className="text-xs text-brand-cream/70 leading-relaxed font-serif">
              <span className="font-serif font-black text-brand-gold">Focus Focus:</span> {week.description}
            </p>

            {/* Checklists */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase tracking-widest font-black text-brand-rose">Week Checklist</span>
              {week.tasks.map(task => {
                const isChecked = !!checkedTasks[task.id];
                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskToggle(task.id, week.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition cursor-pointer select-none ${isChecked ? 'bg-brand-rose/10 border-brand-rose/30 text-brand-cream/85' : 'bg-brand-plum/10 border-brand-rose/5 hover:border-brand-rose/20 text-brand-cream'}`}
                  >
                    <button className="shrink-0 mt-0.5">
                      {isChecked ? (
                        <Check className="w-4 h-4 text-brand-gold stroke-[3]" />
                      ) : (
                        <Circle className="w-4 h-4 text-brand-gold/40" />
                      )}
                    </button>
                    <span className={`text-[12.5px] leading-tight font-medium ${isChecked ? 'line-through opacity-60' : ''}`}>
                      {task.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Interactive Spotlight projects card panel */}
            <div className="bg-brand-plum-deep/60 p-4 rounded-xl border border-brand-rose/15 flex flex-col gap-2 relative">
              <span className="text-[10px] text-brand-gold font-extrabold uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <Flame className="w-4 h-4 animate-bounce" /> Recommended Week Spotlight Video Project
              </span>
              <p className="text-xs font-serif italic text-brand-cream/90 leading-relaxed">
                "{week.project.title}: {week.project.prompt}"
              </p>
            </div>

            {/* Clickable links */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-brand-rose">Training Classroom tutorials & Links</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {week.resources.map((res, rid) => (
                  <a
                    key={rid}
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-brand-plum-deep/80 p-2.5 rounded-lg border border-brand-rose/5 hover:border-brand-rose/25 group transition text-xs hover:text-brand-gold"
                  >
                    <span className="font-serif leading-tight font-extrabold pr-4 truncate">{res.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-brand-rose group-hover:text-brand-gold shrink-0" />
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    );
  }
}
