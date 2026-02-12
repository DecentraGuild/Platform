export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  const auth = useAuth()
  void auth.fetchMe()
})
