<template>
  <ion-app>
    <ion-router-outlet />
    <ion-toast
      :key="errorToastKey"
      :is-open="errorToastMessage !== ''"
      :message="errorToastMessage"
      color="danger"
      position="top"
      :duration="5000"
      @did-dismiss="errorToastMessage = ''"
    />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonToast } from '@ionic/vue';
import { errorToastKey, errorToastMessage } from '@/core/composables/useErrorToast';
</script>
