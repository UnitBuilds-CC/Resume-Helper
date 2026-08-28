export default function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 90 ? 'text-green-400' : score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const bg = score >= 90 ? 'bg-green-400' : score >= 70 ? 'bg-blue-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-zinc-800" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className={color}
            strokeWidth="3" strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round"
            style={{ strokeDashoffset: 0 }}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}>
          {score}
        </div>
      </div>
      <span className="text-xs text-zinc-400 mt-1">{label}</span>
    </div>
  );
}
