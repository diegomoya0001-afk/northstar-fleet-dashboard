import React, { useState } from 'react';
import { Shield, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionText: string;
}

export default function PinModal({ isOpen, onClose, onSuccess, actionText }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('security_pin')
        .limit(1)
        .single();

      if (error) throw error;

      if (data?.security_pin === pin) {
        setPin('');
        onSuccess();
      } else {
        setError('Incorrect PIN. Authorization denied.');
        setPin('');
      }
    } catch (err: any) {
      setError('Error verifying PIN.');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm px-4">
      <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-black text-white text-center">Security PIN Required</h2>
          <p className="text-sm text-gray-400 text-center mt-2 font-medium">
            Enter the 4-digit administrator PIN to {actionText}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-32 bg-black border-2 border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-black tracking-widest focus:outline-none focus:border-red-500 transition-colors mb-4"
            placeholder="••••"
            autoFocus
          />
          
          {error && <p className="text-red-500 text-xs font-bold mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Verifying...' : 'Authorize Action'}
          </button>
        </form>
      </div>
    </div>
  );
}
