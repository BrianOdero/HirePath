import { modalController } from '@ionic/vue';
import PaywallView from '@/features/subscription/views/PaywallView.vue';

export function usePaywall() {
  async function openPaywall(): Promise<void> {
    const modal = await modalController.create({
      component: PaywallView,
      cssClass: 'paywall-modal',
      breakpoints: [0.4, 0.75],
      initialBreakpoint: 0.75,
    });
    await modal.present();
  }

  return { openPaywall };
}
