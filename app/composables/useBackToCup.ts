/**
 * Closes the about page for the cup: back through history when the cup was
 * the page before, so the browser's Back does not open it again, and to the
 * cup's address when the about page was opened first, from a link.
 */
export function useBackToCup(): () => void {
  const router = useRouter()
  return () => {
    if (window.history.state?.back) router.back()
    else void router.push('/')
  }
}
