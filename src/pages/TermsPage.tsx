
import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TermsPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Terms and Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-foreground">
            <p className="text-muted-foreground text-center">Last updated: March 16, 2026</p>

            <p className="font-semibold text-center">Applicable to all bicycle transport bookings</p>

            <div className="space-y-1 text-center text-muted-foreground">
              <p className="font-semibold text-foreground">Cycorco Ltd trading as Cycle Courier Co.</p>
              <p>Registered office: 30 Wake Green Road, Birmingham, B13 9PB</p>
              <p>General enquiries: <a href="mailto:info@cyclecourierco.com" className="text-primary underline">info@cyclecourierco.com</a></p>
              <p>Claims: <a href="mailto:info@cyclecourierco.com" className="text-primary underline">info@cyclecourierco.com</a></p>
              <p>Complaints: <a href="mailto:info@cyclecourierco.com" className="text-primary underline">info@cyclecourierco.com</a></p>
              <p>Telephone: <a href="tel:+441217980767" className="text-primary underline">+44 121 798 0767</a></p>
            </div>

            <p>Please read these Terms and Conditions carefully before placing a booking. By making a booking with us, you agree to be bound by these Terms and Conditions.</p>
            <p>These Terms and Conditions apply to the collection, transport, temporary storage, and delivery of cycles and related items by Cycle Courier Co.</p>

            {/* 1. Definitions */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">1. Definitions</h2>
              <p>In these Terms and Conditions:</p>
              <dl className="space-y-2 pl-4">
                <div><dt className="font-medium inline">Agreement</dt> <dd className="inline">means these Terms and Conditions together with the Booking Confirmation.</dd></div>
                <div><dt className="font-medium inline">Booking</dt> <dd className="inline">means the order placed by you and accepted by us for the provision of our services.</dd></div>
                <div><dt className="font-medium inline">Booking Confirmation</dt> <dd className="inline">means our confirmation email, invoice, message, or other written acceptance of your Booking.</dd></div>
                <div><dt className="font-medium inline">Business Customer</dt> <dd className="inline">means a customer acting for purposes relating to their trade, business, craft, or profession.</dd></div>
                <div><dt className="font-medium inline">Collection Point</dt> <dd className="inline">means the address at which we collect the Cycle from you or your nominated sender.</dd></div>
                <div><dt className="font-medium inline">Condition Report</dt> <dd className="inline">means the written, photographic, and/or video record of the visible condition of the Cycle completed by us at collection and, where applicable, at delivery.</dd></div>
                <div><dt className="font-medium inline">Consumer</dt> <dd className="inline">means an individual acting for purposes wholly or mainly outside their trade, business, craft, or profession.</dd></div>
                <div><dt className="font-medium inline">Cycle</dt> <dd className="inline">means the bicycle, e-bike, trike, cargo bike, trailer bike, or similar cycle item described in the Booking Confirmation, together with only those accessories specifically listed in the Booking Confirmation.</dd></div>
                <div><dt className="font-medium inline">Declared Value</dt> <dd className="inline">means the value of the Cycle stated by you when booking.</dd></div>
                <div><dt className="font-medium inline">Delivery Point</dt> <dd className="inline">means the address to which the Cycle is to be delivered.</dd></div>
                <div><dt className="font-medium inline">Market Value</dt> <dd className="inline">means the fair current second-hand market value of the Cycle at the date of collection, taking into account its age, make, model, specification, condition, provenance, and any declared upgrades or custom parts.</dd></div>
                <div><dt className="font-medium inline">Pre-existing Damage</dt> <dd className="inline">means any defect, scratch, dent, crack, chip, mechanical issue, poor repair, corrosion, wear, or other imperfection present at the time of collection, whether or not specifically noted in the Condition Report, provided it was visible or reasonably apparent on inspection.</dd></div>
                <div><dt className="font-medium inline">Service</dt> <dd className="inline">means the collection, transport, temporary storage, and delivery service described in the Booking Confirmation.</dd></div>
                <div><dt className="font-medium inline">Transit</dt> <dd className="inline">means the period beginning when we or our driver take physical possession of the Cycle and ending when the Cycle is delivered, made available for collection, returned to you, or otherwise dealt with in accordance with this Agreement.</dd></div>
                <div><dt className="font-medium inline">Unboxed Transport</dt> <dd className="inline">means the carriage of a Cycle without a protective box or hard case, using our specialist racking, strapping, padding, and securing equipment.</dd></div>
                <div><dt className="font-medium inline">Working Day</dt> <dd className="inline">means Monday to Friday, excluding public holidays in England.</dd></div>
                <div><dt className="font-medium inline">We, us, and our</dt> <dd className="inline">mean Cycle Courier Co., its directors, employees, drivers, and agents.</dd></div>
                <div><dt className="font-medium inline">You and your</dt> <dd className="inline">mean the person or business placing the Booking.</dd></div>
              </dl>
            </section>

            {/* 2. Our Contract With You */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">2. Our Contract With You</h2>
              <p>2.1 A contract is formed when we issue a Booking Confirmation.</p>
              <p>2.2 The Booking Confirmation and these Terms and Conditions form the entire agreement between you and us in relation to the Service.</p>
              <p>2.3 If there is any conflict between these Terms and Conditions and the Booking Confirmation, the Booking Confirmation shall take priority.</p>
              <p>2.4 We may refuse any Booking before acceptance at our discretion.</p>
            </section>

            {/* 3. Our Services */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">3. Our Services</h2>
              <p>3.1 We provide a specialist cycle courier service, including unboxed transport of cycles between agreed collection and delivery points.</p>
              <p>3.2 Unless expressly agreed in writing, our Service is a transport service only. It does not include:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>dismantling or reassembly beyond minor handling reasonably required for loading, securing, or unloading;</li>
                <li>mechanical inspection, diagnosis, repair, or servicing;</li>
                <li>packing or packaging;</li>
                <li>carriage of loose items not specifically listed in the Booking Confirmation;</li>
                <li>setting up, tuning, or road-testing the Cycle.</li>
              </ol>
              <p>3.3 We will provide the Service with reasonable care and skill.</p>
              <p>3.4 We may choose the route, vehicle, driver, and method of transport used.</p>
            </section>

            {/* 4. What We Can and Cannot Carry */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">4. What We Can and Cannot Carry</h2>
              <p>4.1 We will only carry items that we have agreed in writing to carry.</p>
              <p>4.2 Unless expressly accepted by us in writing, we do not carry:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>cash, jewellery, watches, passports, documents, laptops, phones, or other valuables;</li>
                <li>illegal goods;</li>
                <li>dangerous or hazardous goods;</li>
                <li>loose lithium batteries;</li>
                <li>fuel, oils, chemicals, explosives, or flammables;</li>
                <li>any item prohibited by law or by our insurer;</li>
                <li>accessories or loose items not specifically listed in the Booking Confirmation.</li>
              </ol>
              <p>4.3 E-bikes must be disclosed at the time of booking. We may refuse any e-bike that appears unsafe, materially modified, damaged, or unsuitable for transport.</p>
              <p>4.4 We reserve the right to decline any Cycle that, in our reasonable opinion:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>cannot be safely transported using our methods;</li>
                <li>is materially different from the booking details;</li>
                <li>presents a health and safety risk;</li>
                <li>appears stolen or subject to a criminal investigation;</li>
                <li>has a value that cannot be reasonably evidenced if requested.</li>
              </ol>
            </section>

            {/* 5. Your Responsibilities */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">5. Your Responsibilities</h2>
              <p>5.1 You must ensure that all booking information is complete and accurate, including:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>names, addresses, and contact details;</li>
                <li>make, model, and type of Cycle;</li>
                <li>whether the Cycle is electric;</li>
                <li>the Declared Value;</li>
                <li>any unusual dimensions, modifications, or delicate features;</li>
                <li>any existing damage, defects, prior repairs, or structural issues, including carbon repairs.</li>
              </ol>
              <p>5.2 The Cycle must be reasonably clean and accessible so that its condition can be photographed and inspected at collection.</p>
              <p>5.3 You must securely attach all loose items before collection unless we have agreed in writing to transport them.</p>
              <p>5.4 Unless specifically listed in the Booking Confirmation, accessories such as lights, computers, pumps, bottles, bags, panniers, tool kits, child seats, removable electronics, and similar items are carried at your own risk and may be refused.</p>
              <p>5.5 You must ensure that the Cycle is in a condition that can be safely handled and transported.</p>
              <p>5.6 Where reasonably possible, you or the sender should take sensible precautions to protect vulnerable areas of the Cycle before collection, particularly where the Cycle is new, recently refurbished, or has delicate or high-value components. This may include the use of foam pipe lagging, bubble wrap, frame protection, fork spacers, or similar protective materials on exposed or vulnerable parts.</p>
              <p>5.7 Before collection, you should:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>ensure tyres are at a sensible transport pressure;</li>
                <li>remove high-value removable items where possible;</li>
                <li>disclose any delicate, damaged, or non-standard parts;</li>
                <li>make the Cycle available at the agreed time and location.</li>
              </ol>
              <p>5.8 You are responsible for any additional cost, loss, or delay caused by inaccurate information, undisclosed defects, restricted access, missed handover, or breach of this Agreement.</p>
              <p>5.9 You confirm that you are the owner of the Cycle or are authorised by the owner to instruct us to transport it.</p>
            </section>

            {/* 6. Collection, Delivery, and Failed Attempts */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">6. Collection, Delivery, and Failed Attempts</h2>
              <p>6.1 Collection and delivery dates and windows are estimates unless we expressly guarantee them in writing.</p>
              <p>6.2 We may request identification, proof of address, proof of ownership, or proof of authority to release or receive the Cycle.</p>
              <p>6.3 If collection cannot be completed because:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>no one is available;</li>
                <li>access is unsafe or unavailable;</li>
                <li>the Cycle is materially different from the booking details;</li>
                <li>the Cycle is not ready for collection; or</li>
                <li>the Cycle cannot be safely transported,</li>
              </ol>
              <p>we may charge a failed collection fee, waiting fee, or rebooking fee at our then-current rates.</p>
              <p>6.4 If delivery cannot be completed because:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>no one is available;</li>
                <li>access is unsafe or unavailable;</li>
                <li>delivery is refused;</li>
                <li>outstanding charges remain unpaid; or</li>
                <li>we reasonably believe the recipient is not authorised to receive the Cycle,</li>
              </ol>
              <p>we may charge redelivery, storage, or return fees at our then-current rates.</p>
              <p>6.5 Unless otherwise agreed, we will make one delivery attempt. Additional attempts, return transport, or storage will be charged.</p>
              <p>6.6 We will not leave a Cycle unattended unless you have expressly authorised this in writing. If you instruct us to leave the Cycle in a safe place, with a neighbour, concierge, reception desk, or other third party, delivery will be treated as completed once it has been left in accordance with those instructions.</p>
            </section>

            {/* 7. Condition Recording and Handover */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">7. Condition Recording and Handover</h2>
              <p>7.1 We may inspect, photograph, and/or video the Cycle at collection and delivery.</p>
              <p>7.2 At collection, we may complete a Condition Report recording the visible condition of the Cycle, including any pre-existing marks, chips, cracks, scratches, bent components, worn parts, corrosion, crash damage, transport damage, or poor repairs.</p>
              <p>7.3 You, your sender, or your recipient should review the Condition Report where reasonably possible and raise any disagreement at the point of handover.</p>
              <p>7.4 Our photographs, videos, driver notes, and Condition Reports, together with any evidence you provide, may be used to assess any later claim.</p>
              <p>7.5 If you are not present at collection or delivery and have authorised an unattended handover, our records will be treated as strong evidence of the Cycle's condition and the fact of collection or delivery.</p>
              <p>7.6 A signature or acceptance at delivery without damage being noted will be treated as evidence that no visible damage was identified at handover, but it will not prevent you from making a valid claim for damage that was not reasonably apparent at that time.</p>
            </section>

            {/* 8. Charges and Payment */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">8. Charges and Payment</h2>
              <p>8.1 Prices are as shown on the pricing page or otherwise agreed in writing.</p>
              <p>8.2 Unless we have agreed account terms in writing, all charges must be paid in full before collection.</p>
              <p>8.3 We may charge additional sums where:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>the Cycle differs materially from the booking;</li>
                <li>the Declared Value was inaccurate;</li>
                <li>extra waiting time is required;</li>
                <li>collection or delivery conditions are materially different from those described;</li>
                <li>additional storage, redelivery, return, toll, ferry, remote-area, congestion, or access costs arise.</li>
              </ol>
              <p>8.4 If payment is overdue, we may suspend performance, retain possession of the Cycle until payment is made, and charge reasonable recovery costs.</p>
              <p>8.5 All prices are inclusive of VAT where applicable unless stated otherwise.</p>
            </section>

            {/* 9. Cancellations and Changes */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">9. Cancellations and Changes</h2>
              <p>9.1 You may request to cancel or change a Booking by contacting us using the details above.</p>
              <p>9.2 Unless we agree otherwise in writing, our standard cancellation charges are:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>more than 24 hours before collection: full refund;</li>
                <li>within 24 hours before collection: up to 50% of the booking price;</li>
                <li>where collection fails due to your default, or where the Cycle is not made available as agreed: up to 100% of the booking price.</li>
              </ol>
              <p>9.3 If you are a Consumer and your Booking is made at a distance or off-premises, you may in some circumstances have statutory cancellation rights. However, where the Booking is for the transport of goods on a specific date or during a specific period, those statutory cancellation rights may not apply. Nothing in this clause affects any cancellation rights you have under applicable law.</p>
              <p>9.4 If you are a Consumer and statutory cancellation rights do apply, and you ask us to begin performing the Service during any applicable cancellation period, you agree that:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>we may begin performance before that period ends; and</li>
                <li>you may be required to pay for any services supplied up to the time of cancellation, to the extent permitted by law.</li>
              </ol>
              <p>9.5 We may cancel or reschedule a Booking if required by safety, legality, vehicle issues, severe weather, traffic disruption, staff illness, force majeure, or other matters beyond our reasonable control. If we cancel and cannot provide a reasonable alternative, we will refund sums paid for the affected Service.</p>
            </section>

            {/* 10. Insurance and Liability */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">10. Insurance and Liability</h2>
              <p>10.1 We maintain goods-in-transit insurance that we consider appropriate for our business.</p>
              <p>10.2 Our insurance arrangements do not create any direct contractual rights for you against our insurer and do not, by themselves, increase our liability beyond this Agreement unless we expressly agree otherwise in writing.</p>
              <p>10.3 Nothing in this Agreement excludes or limits liability for:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>death or personal injury caused by negligence;</li>
                <li>fraud or fraudulent misrepresentation;</li>
                <li>any other liability that cannot lawfully be excluded or limited.</li>
              </ol>
              <p>10.4 Subject to clause 10.3, we are only liable for direct physical loss of or direct physical damage to the Cycle occurring during Transit and caused by our negligence or breach of contract.</p>
              <p>10.5 Subject to clause 10.3, we are not liable for:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>Pre-existing Damage or defects;</li>
                <li>latent or hidden defects;</li>
                <li>ordinary wear, corrosion, deterioration, or purely mechanical or electrical failure not caused by us;</li>
                <li>loss of use, loss of enjoyment, loss of revenue, loss of business, loss of goodwill, travel costs, accommodation costs, race entry fees, or any indirect or consequential loss;</li>
                <li>loss of or damage to accessories or loose items not specifically listed in the Booking Confirmation;</li>
                <li>loss or damage caused by inaccurate information or your failure to comply with this Agreement;</li>
                <li>loss or damage occurring after an unattended delivery carried out in accordance with your instructions;</li>
                <li>delay or non-performance caused by matters beyond our reasonable control.</li>
              </ol>
              <p>10.6 Subject to clause 10.3, unless a higher amount is expressly accepted by us in writing in the Booking Confirmation, our maximum liability for any one Cycle shall be the lowest of:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>the reasonable cost of repair;</li>
                <li>the Market Value of the Cycle at the time of collection;</li>
                <li>the Declared Value.</li>
              </ol>
              <p>10.7 We may refuse higher-value Cycles or require evidence of value, additional protections, or bespoke terms before accepting a higher level of liability.</p>
              <p>10.8 Nothing in this clause affects any rights a Consumer may have under applicable law where liability cannot lawfully be excluded or limited.</p>
            </section>

            {/* 11. Valuation of Cycles and Damage Assessment */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">11. Valuation of Cycles and Damage Assessment</h2>
              <p>11.1 Our aim is to place you in the position you would have been in had the loss or damage not occurred, but not in a better position.</p>
              <p>11.2 Where damage can reasonably be repaired, we may choose to settle the claim by paying:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>the reasonable repair cost;</li>
                <li>the reasonable cost of replacement parts; and/or</li>
                <li>reasonable carriage to and from an approved repairer,</li>
              </ol>
              <p>instead of treating the Cycle as a total loss.</p>
              <p>11.3 If a repair would result in betterment, improvement, or upgrade beyond the Cycle's pre-loss condition, we may make a reasonable deduction.</p>
              <p>11.4 If a Cycle is deemed a total loss, compensation will be based on its Market Value at the time of collection, not replacement-as-new value, unless expressly agreed otherwise in writing.</p>
              <p>11.5 In assessing Market Value, we may consider:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>original purchase documents;</li>
                <li>age, make, model, and specification;</li>
                <li>service history;</li>
                <li>condition at collection;</li>
                <li>mileage or usage where relevant;</li>
                <li>evidence of upgrades or custom parts;</li>
                <li>comparable recent sold prices for similar cycles;</li>
                <li>independent retailer, mechanic, or insurer valuations;</li>
                <li>Pre-existing Damage, wear, and depreciation.</li>
              </ol>
              <p>11.6 Upgrades, custom parts, premium wheelsets, and specialist components will only be included in valuation where they were declared at booking and reasonably evidenced.</p>
              <p>11.7 We may appoint an independent assessor or request one or more repair quotes before deciding a claim.</p>
              <p>11.8 If we pay the full assessed value of a Cycle or major component, title to the damaged Cycle or component shall pass to us once payment is made, and we may retain, recover, dispose of, or salvage it.</p>
            </section>

            {/* 12. Claims Procedure */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">12. Claims Procedure</h2>
              <p>12.1 On delivery, you or the recipient should inspect the Cycle as soon as reasonably possible.</p>
              <p>12.2 If there is visible damage or obvious missing parts, this should be recorded at delivery and notified to us as soon as possible.</p>
              <p>12.3 We must be notified:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>for visible loss or damage, within 48 hours of delivery;</li>
                <li>for concealed loss or damage not reasonably discoverable at delivery, within 5 calendar days of delivery;</li>
                <li>for non-delivery, within 5 calendar days after the scheduled delivery date.</li>
              </ol>
              <p>12.4 A claim must include, where available:</p>
              <ol className="list-[lower-alpha] pl-8 space-y-1">
                <li>booking reference;</li>
                <li>photographs of the Cycle before collection, if available;</li>
                <li>photographs of the alleged damage on delivery;</li>
                <li>photographs of the whole Cycle and damaged area;</li>
                <li>proof of ownership;</li>
                <li>proof of value;</li>
                <li>details of any upgrades or custom parts;</li>
                <li>a repair estimate if repair is sought;</li>
                <li>any delivery note, Condition Report, or driver note.</li>
              </ol>
              <p>12.5 You must not arrange repairs, replace parts, dispose of damaged parts, or materially alter the evidence before we have had a reasonable opportunity to inspect, unless immediate action is required for safety or to prevent further loss.</p>
              <p>12.6 Failure to comply with this clause may reduce or defeat a claim where that failure materially prejudices our ability to investigate it.</p>
              <p>12.7 We aim to acknowledge claims within 3 Working Days and aim to provide a decision within 14 Working Days after receiving all information we reasonably require.</p>
              <p>12.8 Where we require further information or an independent assessment, we will let you know.</p>
              <p>12.9 Any settlement offer made by us may be accepted in full and final settlement of that claim.</p>
            </section>

            {/* 13. Storage, Retention, and Uncollected Cycles */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">13. Storage, Retention, and Uncollected Cycles</h2>
              <p>13.1 If we are unable to deliver, redeliver, or return a Cycle, we may store it.</p>
              <p>13.2 We may charge reasonable storage fees from 3 Working Days after notifying you that storage is required.</p>
              <p>13.3 We may retain possession of the Cycle until all outstanding sums due to us are paid.</p>
              <p>13.4 If a Cycle remains uncollected for more than 90 days after written notice to you, we may sell or otherwise dispose of it to recover unpaid charges and our reasonable costs. Any surplus proceeds remaining after deduction of sums properly due to us will be returned to you where reasonably possible.</p>
            </section>

            {/* 14. Events Outside Our Control */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">14. Events Outside Our Control</h2>
              <p>14.1 We are not liable for delay, loss, failure to collect, or failure to deliver caused by events beyond our reasonable control, including severe weather, road closures, traffic disruption, vehicle breakdown, accidents, strikes, civil unrest, government action, war, terrorism, epidemic, fire, or flood.</p>
              <p>14.2 Where reasonably possible, we will take reasonable steps to minimise disruption and keep you informed.</p>
            </section>

            {/* 15. Data Protection */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">15. Data Protection</h2>
              <p>15.1 We process personal data in accordance with our Privacy Policy and applicable data protection law.</p>
              <p>15.2 You confirm that you have permission to provide us with the contact details of any sender, recipient, or third party involved in the Booking.</p>
            </section>

            {/* 16. Consumers and Business Customers */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">16. Consumers and Business Customers</h2>
              <p>16.1 If you are a Business Customer, you confirm that you have authority to bind the business on whose behalf you book.</p>
              <p>16.2 For Business Customers, any implied terms not required by law are excluded to the fullest extent permitted by law.</p>
              <p>16.3 Business Customers must inspect deliveries promptly and comply with the claims procedure in clause 12.</p>
              <p>16.4 If you are a Consumer, nothing in this Agreement affects your mandatory statutory rights.</p>
            </section>

            {/* 17. General */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">17. General</h2>
              <p>17.1 We may update these Terms and Conditions from time to time, but the version in force at the time of Booking will apply to that Booking.</p>
              <p>17.2 If any provision is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
              <p>17.3 A person who is not a party to this Agreement shall have no right to enforce any term under the Contracts (Rights of Third Parties) Act 1999.</p>
              <p>17.4 No waiver by either party of any breach shall be treated as a waiver of any later breach.</p>
              <p>17.5 If you are unhappy with our Service, please contact us in the first instance at <a href="mailto:info@cyclecourierco.com" className="text-primary underline">info@cyclecourierco.com</a>.</p>
            </section>

            {/* 18. Governing Law and Jurisdiction */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">18. Governing Law and Jurisdiction</h2>
              <p>18.1 These Terms and any dispute or claim arising out of or in connection with them shall be governed by the law of England and Wales.</p>
              <p>18.2 The courts of England and Wales shall have jurisdiction, except that Consumers living in Scotland or Northern Ireland may also have rights to bring proceedings in their home courts.</p>
            </section>

            <div className="pt-4 border-t text-muted-foreground text-center">
              <p>Version: 1.0</p>
              <p>Effective from: 16.03.2026</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TermsPage;
