import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-6">
            Turn Every HVAC Installation Into Repeat Service Revenue.
          </h1>
          <p className="text-xl mb-8">
            Give every system you install a QR-powered digital passport for
            warranties, equipment information and service history — while
            automatically tracking when customers are due for maintenance.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="#how-it-works"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">The Problem</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Lost Warranty Information</h3>
              <p className="text-gray-600">
                Customers lose paper warranties, leading to missed service
                opportunities and frustration.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">No Service History</h3>
              <p className="text-gray-600">
                No way to track maintenance history, making it difficult to
                prove warranty claims or diagnose issues.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Missed Service Opportunities</h3>
              <p className="text-gray-600">
                No automated reminders for upcoming services, resulting in
                lost repeat business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Add Equipment</h3>
                  <p className="text-gray-600">
                    Record every HVAC unit you install with details like
                    model, serial number, installation date, and warranty.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Generate QR Code</h3>
                  <p className="text-gray-600">
                    System creates a unique QR code for each unit that you can
                    print and attach to the equipment.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Customer Scans</h3>
                  <p className="text-gray-600">
                    Homeowner scans the QR code to see warranty, service
                    history, and book future service.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Automated Reminders</h3>
                  <p className="text-gray-600">
                    You get notified when equipment is due for service, so you
                    can reach out and schedule maintenance.
                  </p>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <Image
                src="/placeholder.svg"
                alt="How it works illustration"
                width={600}
                height={400}
                className="rounded-lg shadow"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Benefits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">More Repeat Service Jobs</h3>
              <p className="text-gray-600">
                Stay top-of-mind with customers and increase service
                revenue through timely maintenance reminders.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Professional Customer Experience</h3>
              <p className="text-gray-600">
                Provide customers with a modern, digital way to access
                important equipment information.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Warranty Information in One Place</h3>
              <p className="text-gray-600">
                No more digging through files — all warranty details are
                instantly accessible via QR code.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Complete Equipment History</h3>
              <p className="text-gray-600">
                Maintain a full service history for each unit, making
                warranty claims and diagnostics easier.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">No Spreadsheets</h3>
              <p className="text-gray-600">
                Eliminate manual tracking and reduce errors with automated
                service date calculations.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Simple QR Labels</h3>
              <p className="text-gray-600">
                Generate and print professional QR labels in seconds — no
                design skills needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
          <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">
            Simple, transparent pricing that grows with your business.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Starter</h3>
              <p className="text-2xl font-bold mb-4">$29/month</p>
              <ul className="space-y-4 text-gray-600 mb-6">
                <li>Up to 100 active equipment records</li>
                <li>QR code generation</li>
                <li>Service passport</li>
                <li>Service reminders</li>
                <li>Document storage</li>
                <li>Email support</li>
              </ul>
              <Link
                href="/dashboard"
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
            {/* Growth Plan */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Growth</h3>
              <p className="text-2xl font-bold mb-4">$59/month</p>
              <ul className="space-y-4 text-gray-600 mb-6">
                <li>Up to 500 active equipment records</li>
                <li>Everything in Starter</li>
                <li>Priority support</li>
                <li>Customizable service intervals</li>
                <li>Advanced reporting</li>
              </ul>
              <Link
                href="/dashboard"
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
            {/* Pro Plan */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Pro</h3>
              <p className="text-2xl font-bold mb-4">$99/month</p>
              <ul className="space-y-4 text-gray-600 mb-6">
                <li>Up to 2,000 active equipment records</li>
                <li>Everything in Growth</li>
                <li>Dedicated account manager</li>
                <li>API access</li>
                <li>White-label options</li>
                <li>Phone support</li>
              </ul>
              <Link
                href="/dashboard"
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">Is my data secure?</h3>
              <p className="text-gray-600">
                Yes. We use industry-standard encryption and Supabase&apos;s
                security features to protect your data. Each company&apos;s data
                is isolated using Row Level Security.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">Do I need technical skills to use this?</h3>
              <p className="text-gray-600">
                No. UnitPass is designed for HVAC technicians and office
                staff. The interface is intuitive and requires no training.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">Can I try it before buying?</h3>
              <p className="text-gray-600">
                Yes! We offer a 14-day free trial with no credit card
                required. You can create your first QR passport in minutes.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">What happens after the trial?</h3>
              <p className="text-gray-600">
                You&apos;ll be prompted to choose a plan and enter payment
                information. Your data will be preserved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8">
            Ready to turn every installation into repeat service revenue?
          </h2>
          <p className="text-center text-white/90 mb-8 max-w-xl mx-auto">
            Start your free trial today and see how UnitPass can help your
            HVAC business grow.
          </p>
          <div className="flex justify-center">
            <Link
              href="/dashboard"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}