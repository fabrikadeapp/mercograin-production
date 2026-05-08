import { LandingNav } from './LandingNav'
import { Hero } from './Hero'
import { LiveProof } from './LiveProof'
import { Features } from './Features'
import { ScreenshotShowcase } from './ScreenshotShowcase'
import { Pricing } from './Pricing'
import { Faq } from './Faq'
import { Footer } from './Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />
      <main>
        <Hero />
        <LiveProof />
        <Features />
        <ScreenshotShowcase />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
