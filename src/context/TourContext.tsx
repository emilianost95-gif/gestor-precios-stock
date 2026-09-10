import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from './StoreContext';
import { useProductActions } from './ProductActionsContext';
import { readCompletedLessons, saveCompletedLessons } from '@/storage';
import { LESSONS, getLesson, lessonProgress, type Lesson, type TourStep } from '@/services/copilot/tours';

export interface SpotlightRequest {
  target: string;
  title: string;
  body: string;
}

interface TourContextValue {
  lesson: Lesson | null;
  step: TourStep | null;
  stepIndex: number;
  stepCount: number;
  running: boolean;
  startLesson: (id: string) => boolean;
  next: () => void;
  prev: () => void;
  stop: () => void;
  /** Resalta un elemento suelto, fuera de una lección. */
  spotlight: (request: SpotlightRequest) => void;
  singleSpotlight: SpotlightRequest | null;
  clearSpotlight: () => void;
  completed: string[];
  progress: { done: number; total: number };
  allCoreDone: boolean;
  lessons: Lesson[];
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { products } = useStore();
  const { editPrice, editStock, newProduct, viewProduct } = useProductActions();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [singleSpotlight, setSingleSpotlight] = useState<SpotlightRequest | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => readCompletedLessons());
  const productsRef = useRef(products);
  productsRef.current = products;

  const step = lesson ? (lesson.steps[stepIndex] ?? null) : null;

  /** Producto de ejemplo para los pasos que necesitan abrir un editor. */
  const sampleProduct = useCallback(() => {
    const list = productsRef.current;
    if (list.length === 0) return null;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))[0];
  }, []);

  // Efectos de entrada del paso: navegar y abrir lo que corresponda.
  useEffect(() => {
    if (!lesson || !step) return;
    if (step.route) navigate(step.route);

    if (!step.open) return;
    const timer = window.setTimeout(() => {
      const product = sampleProduct();
      switch (step.open) {
        case 'editor-precio':
          if (product) editPrice(product);
          break;
        case 'editor-stock':
          if (product) editStock(product);
          break;
        case 'primer-producto':
          if (product) viewProduct(product);
          break;
        case 'nuevo-producto':
          newProduct();
          break;
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [lesson, step, navigate, sampleProduct, editPrice, editStock, viewProduct, newProduct]);

  const markCompleted = useCallback((id: string) => {
    setCompleted((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveCompletedLessons(next);
      return next;
    });
  }, []);

  const startLesson = useCallback(
    (id: string) => {
      const found = getLesson(id);
      if (!found) return false;
      setSingleSpotlight(null);
      setLesson(found);
      setStepIndex(0);
      return true;
    },
    [],
  );

  const stop = useCallback(() => {
    setLesson(null);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (!lesson) return;
    if (stepIndex >= lesson.steps.length - 1) {
      markCompleted(lesson.id);
      stop();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [lesson, stepIndex, markCompleted, stop]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const spotlight = useCallback((request: SpotlightRequest) => {
    setLesson(null);
    setSingleSpotlight(request);
  }, []);

  const clearSpotlight = useCallback(() => setSingleSpotlight(null), []);

  const progress = useMemo(() => lessonProgress(completed), [completed]);

  const value = useMemo<TourContextValue>(
    () => ({
      lesson,
      step,
      stepIndex,
      stepCount: lesson?.steps.length ?? 0,
      running: lesson !== null,
      startLesson,
      next,
      prev,
      stop,
      spotlight,
      singleSpotlight,
      clearSpotlight,
      completed,
      progress,
      allCoreDone: progress.done >= progress.total,
      lessons: LESSONS,
    }),
    [
      lesson,
      step,
      stepIndex,
      startLesson,
      next,
      prev,
      stop,
      spotlight,
      singleSpotlight,
      clearSpotlight,
      completed,
      progress,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour debe usarse dentro de <TourProvider>.');
  return ctx;
}
