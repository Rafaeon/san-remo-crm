import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CircleCheck, LoaderCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { distributeNextLead } from '@/services/crm.functions';
import { easeOutCubic, landingRotation, segmentCenterAngle } from '@/lib/roulette';
import type { Broker } from '@/types/crm';

const SPIN_DEG_PER_S = 380;
const MIN_SPIN_MS = 2200;
const LANDING_MS = 2600;

type DistributionResult = { lead_id: string; lead_name: string; broker_id: string; broker_name: string; operation_id: string; distributed_at: string };

export function DistributionRoulette({ brokers, onDistributed, onClose }: { brokers: Broker[]; onDistributed: (result: { lead_name: string; broker_name: string }) => void; onClose: () => void }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const phaseRef = useRef<'spinning' | 'landing' | 'done'>('spinning');
  const landRef = useRef<{ from: number; to: number; start: number } | null>(null);
  const startedRef = useRef(0);
  const firedRef = useRef(false);
  const [phase, setPhase] = useState<'spinning' | 'landing' | 'done'>('spinning');
  const [result, setResult] = useState<DistributionResult | null>(null);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const distribute = useServerFn(distributeNextLead);
  const mutation = useMutation({
    mutationFn: distribute,
    onSuccess: async data => {
      setResult(data);
      await Promise.all([client.invalidateQueries({ queryKey: ['crm'] }), client.invalidateQueries({ queryKey: ['lead'] }), client.invalidateQueries({ queryKey: ['history'] })]);
      onDistributed(data);
    },
    onError: err => setError(err.message),
  });
  useEffect(() => {
    if (firedRef.current) return; firedRef.current = true;
    startedRef.current = performance.now();
    phaseRef.current = 'spinning'; setPhase('spinning');
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!result && !error) return;
    const finish = () => { phaseRef.current = 'done'; setPhase('done'); };
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (error || reduced || !result) { finish(); return; }
    const wait = Math.max(0, MIN_SPIN_MS - (performance.now() - startedRef.current));
    const timer = setTimeout(() => {
      const count = Math.max(brokers.length, 1);
      const winnerIndex = Math.max(0, brokers.findIndex(broker => broker.id === result.broker_id));
      const from = rotationRef.current;
      landRef.current = { from, to: landingRotation(from, winnerIndex, count), start: performance.now() };
      phaseRef.current = 'landing'; setPhase('landing');
    }, wait);
    return () => clearTimeout(timer);
  }, [result, error, brokers]);
  useEffect(() => {
    const wheel = wheelRef.current; if (!wheel) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      const land = landRef.current;
      if (phaseRef.current === 'spinning') rotationRef.current += SPIN_DEG_PER_S * dt;
      else if (phaseRef.current === 'landing' && land) {
        const t = Math.min(1, (now - land.start) / LANDING_MS);
        rotationRef.current = land.from + (land.to - land.from) * easeOutCubic(t);
        if (t >= 1) { phaseRef.current = 'done'; setPhase('done'); }
      }
      wheel.style.transform = `rotate(${rotationRef.current}deg)`;
      if (phaseRef.current !== 'done') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const count = Math.max(brokers.length, 1);
  const segment = 360 / count;
  const gradient = brokers.length
    ? `conic-gradient(from 0deg, ${brokers.map((broker, index) => `${result && phase === 'done' && broker.id === result.broker_id ? 'var(--roulette-win)' : index % 2 ? 'var(--roulette-b)' : 'var(--roulette-a)'} ${index * segment}deg ${(index + 1) * segment}deg`).join(', ')})`
    : 'var(--muted)';
  const busy = phase !== 'done';
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="crm-modal roulette-modal"><DialogTitle>{phase === 'done' ? (error ? 'Não foi possível distribuir' : 'Lead distribuído') : 'Roleta de leads'}</DialogTitle><DialogDescription>Distribuição round-robin entre os corretores habilitados; a roleta é a animação do sorteio.</DialogDescription><div className="roulette-stage"><div className="roulette-pointer"/><div ref={wheelRef} className="roulette-wheel" style={{ background: gradient }} role="img" aria-label="Roleta de corretores">{brokers.map((broker, index) => <span key={broker.id} className={`roulette-label${phase === 'done' && result?.broker_id === broker.id ? ' is-winner' : ''}`} style={{ transform: `rotate(${segmentCenterAngle(index, count)}deg) translateY(-104px) translateX(-50%)` }}>{broker.display_name}</span>)}</div><div className="roulette-hub">{phase !== 'done' ? <LoaderCircle className="animate-spin"/> : error ? <Zap/> : <CircleCheck/>}</div></div><p role={error ? 'alert' : 'status'} className="roulette-status">{error ? error : phase === 'done' && result ? <>Lead <strong>{result.lead_name}</strong> distribuído para <strong>{result.broker_name}</strong>.</> : 'Sorteando o próximo corretor habilitado…'}</p><div className="flex justify-end"><Button disabled={busy} onClick={onClose}>{busy ? <LoaderCircle className="animate-spin"/> : <CircleCheck/>}Fechar</Button></div></DialogContent></Dialog>;
}
