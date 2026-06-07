import { redirect } from 'next/navigation'

// Root redirects to dashboard; middleware handles the auth gate.
export default function RootPage() {
  redirect('/dashboard')
}
