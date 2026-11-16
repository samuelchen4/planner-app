export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://dfdwcpcwdxpuikjtmxci.supabase.co',
  supabaseKey:
    process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_Fr_dJXh0zZAnBImhkXI36A_5JdIKw9S',
  powerSyncUrl:
    process.env.EXPO_PUBLIC_POWERSYNC_URL ??
    'https://6af7ca52e5558a7422b9db59.powersync.journeyapps.com',
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
};
