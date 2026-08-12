import { supabase } from '@/core/services/supabase';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface PaymentRecord {
  id: string;
  user_id: string;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  amount: number;
  phone: string;
  status: PaymentStatus;
  result_code: string | null;
  result_desc: string | null;
  created_at: string;
  updated_at: string;
}

export const paymentsApi = {
  async getPayments(userId: string): Promise<PaymentRecord[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PaymentRecord[];
  },
};