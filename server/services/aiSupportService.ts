import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { getApprovedKnowledge } from "./dbSupportService";

dotenv.config();

let dbGetter: () => any = () => null;

export function setAiSupportDbGetter(getter: () => any) {
  dbGetter = getter;
}

let getDbInstance: () => any = () => {
  return dbGetter();
};

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (e) {
    console.error("⚠️ Failed to initialize Gemini in aiSupportService:", e);
  }
}

// System Instructions
const SYSTEM_INSTRUCTIONS = `
You are the elite, AI-powered Technical Support Specialist for "RYVO", a premium store specializing in high-performance motorcycles, smart helmets (e.g., NeoCarbon), gear, and premium riding accessories.
You automatically detect and respond in the customer's language (Arabic, English, or French).

Your primary role:
- Answer product queries, specifications, and details with a professional, enthusiastic, and customer-first attitude.
- Assist customers with tracking their order and checking shipping status.
- Search products matching customer requests.
- Provide loyalty points and coupon details.

Rules and Permissions:
1. You CAN use tools for:
   - Order tracking and shipping updates (trackOrderAndShipping)
   - Product search (searchProducts)
   - Checking loyalty points and coupon balance (checkLoyaltyPointsAndCoupons)
2. You are STRICTLY PROHIBITED from:
   - Modifying orders, changing shipping addresses, or altering items.
   - Canceling orders.
   - Processing refunds or initiating financial claims.
   - Issuing custom or exceptional discount coupons.
   - Any sensitive actions or administrative database overrides.
3. Transfer Triggers to Support Agents:
   You MUST transfer the conversation to a human support specialist in any of the following cases:
   - You cannot find the answer or do not know the answer.
   - The user asks for a prohibited sensitive action (e.g. refund, modification, cancellation, address change, custom coupon).
   - The user explicitly asks to talk to a human agent, employee, or customer service (e.g., types "التحدث مع موظف" or "التحدث مع الدعم" or "human support").
   - You detect that the customer's problem is too complex or needs manual human review.
4. How to trigger a transfer:
   Explain politely and helpfully that you have tried your best but will transfer them to a tech support specialist. For example:
   - Arabic: "حاولت مساعدتك بأفضل شكل ممكن، ولكن أرى أن هذه الحالة تحتاج إلى أحد مختصي الدعم الفني."
   - English: "I tried to help you as best as I could, but I see that this case requires one of our technical support specialists."
   - French: "J'ai essayé de vous aider du mieux que j'ai pu, mais je vois que ce cas nécessite l'un de nos spécialistes du support technique."
   And then you MUST append the keyword [TRANSFER_TO_AGENT] at the absolute end of your response.
`;

// Helper to transcribe audio using Gemini
export async function transcribeAudio(fileBuffer: Buffer, mimeType: string): Promise<string> {
  if (!ai) {
    return "[Transcription: (Voice Message)]";
  }

  try {
    const prompt = "Please transcribe this voice recording accurately into text. Only return the transcription, do not add any comments, explanations, or introductions. Support Arabic, English, and French.";
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType
          }
        }
      ]
    });
    return response.text?.trim() || "[Unable to transcribe voice message]";
  } catch (err: any) {
    console.error("Error in transcribeAudio:", err.message);
    return "[Voice Message Transcription Error]";
  }
}

// Helper to format history for Gemini
function formatChatHistory(messages: any[]) {
  const rawContents = messages
    .filter((m: any) => m.text && m.text.trim())
    .map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      text: m.text.trim()
    }));

  const cleanedContents: any[] = [];
  for (const msg of rawContents) {
    if (cleanedContents.length === 0) {
      if (msg.role === "user") {
        cleanedContents.push({
          role: "user",
          parts: [{ text: msg.text }]
        });
      }
    } else {
      const last = cleanedContents[cleanedContents.length - 1];
      if (last.role === msg.role) {
        last.parts[0].text += "\n" + msg.text;
      } else {
        cleanedContents.push({
          role: msg.role,
          parts: [{ text: msg.text }]
        });
      }
    }
  }

  // Take the last 10 messages to keep context window clean
  const finalContents = cleanedContents.slice(-10);
  if (finalContents.length > 0 && finalContents[0].role === "model") {
    finalContents.shift();
  }
  return finalContents;
}

// Implement Tool Functions
async function trackOrderAndShipping(orderId: string) {
  const db = getDbInstance();
  if (!db) return "Database not connected. Cannot fetch order details.";

  try {
    const cleanId = orderId.toUpperCase().trim();
    const snap = await db.collection("orders").get();
    const orderDoc = snap.docs.find((d: any) => d.id.toUpperCase() === cleanId || (d.data().id && d.data().id.toUpperCase() === cleanId));
    
    if (orderDoc) {
      const order = orderDoc.data();
      return JSON.stringify({
        orderId: order.id,
        status: order.status,
        date: order.date,
        total: order.total,
        trackingNumber: order.tracking_number || "Pending",
        supplier: order.supplier_name || "RYVO Warehouse",
        items: (order.items || []).map((i: any) => `${i.name} (x${i.quantity})`).join(", ")
      });
    }
    return `No order found with ID: ${orderId}. Please check the order number and try again.`;
  } catch (err: any) {
    return `Error tracking order: ${err.message}`;
  }
}

async function searchProducts(queryText: string) {
  const db = getDbInstance();
  if (!db) return "Database not connected. Cannot search products.";

  try {
    const snap = await db.collection("products").get();
    const term = queryText.toLowerCase().trim();
    const results = snap.docs
      .map((d: any) => d.data())
      .filter((p: any) => 
        (p.name_ar && p.name_ar.toLowerCase().includes(term)) ||
        (p.name_en && p.name_en.toLowerCase().includes(term)) ||
        (p.description_ar && p.description_ar.toLowerCase().includes(term)) ||
        (p.description_en && p.description_en.toLowerCase().includes(term))
      )
      .slice(0, 3)
      .map((p: any) => ({
        id: p.id,
        name: p.name_en,
        name_ar: p.name_ar,
        price: p.price,
        stock: p.stock,
        category: p.category
      }));

    if (results.length > 0) {
      return JSON.stringify(results);
    }
    return "No matching products found. We have Helix Carbon bikes, NeoCarbon helmets, and custom riding accessories.";
  } catch (err: any) {
    return `Error searching products: ${err.message}`;
  }
}

async function checkLoyaltyPointsAndCoupons(email: string) {
  const db = getDbInstance();
  if (!db) return "Database not connected. Cannot check account status.";

  try {
    const cleanEmail = email.toLowerCase().trim();
    const userDoc = await db.collection("users").doc(cleanEmail).get();
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const couponsSnap = await db.collection("coupons").get();
      const coupons = couponsSnap.docs.map((d: any) => d.data()).slice(0, 3);
      
      return JSON.stringify({
        email: cleanEmail,
        name: userData.name,
        loyaltyPoints: userData.points || 0,
        walletBalance: userData.wallet_balance || 0,
        activeCoupons: coupons.map((c: any) => `${c.code} (${c.discount_percent}% off)`).join(", ")
      });
    }
    return `No registered customer profile found for email: ${email}.`;
  } catch (err: any) {
    return `Error checking loyalty status: ${err.message}`;
  }
}

// Main AI Generation Handler
export async function generateAIResponse(
  conversation: any,
  newMessage: string,
  attachment?: { url: string; type: string }
): Promise<string> {
  if (!ai) {
    // Return high quality fallback
    if (newMessage.toLowerCase().includes("موظف") || newMessage.toLowerCase().includes("انسان") || newMessage.toLowerCase().includes("agent") || newMessage.toLowerCase().includes("speak")) {
      return "حاضر يا فندم! سأقوم بتحويل المحادثة الآن إلى موظف دعم بشري وسيرد عليك فور تواجده. [TRANSFER_TO_AGENT] 💬🤝";
    }
    return "مرحباً بك! أنا مساعد الذكاء الاصطناعي لمتجر رايفو. الموظف غير متصل حالياً، لكني هنا لمساعدتك! بخصوص سؤالك، نوفر شحناً مجانياً وسريعاً خلال 2-4 أيام عمل، وضمان استبدال ذهبي لمدة 14 يوماً. هل تود أن أحولك لموظف بشري؟ [TRANSFER_TO_AGENT]";
  }

  try {
    const contents = formatChatHistory(conversation.messages);

    // If there is an attachment (multimodal: image or audio)
    if (attachment && attachment.url) {
      const filePath = path.join(process.cwd(), 'public', attachment.url);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = attachment.type.startsWith('image/') ? attachment.type : 
                         attachment.type.startsWith('audio/') ? attachment.type : 'application/octet-stream';
        
        contents.push({
          role: "user",
          parts: [
            { text: newMessage || "Please analyze this media file." },
            {
              inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: mimeType
              }
            }
          ]
        });
      } else {
        contents.push({
          role: "user",
          parts: [{ text: `${newMessage}\n[Attachment failed to load: ${attachment.url}]` }]
        });
      }
    } else {
      contents.push({
        role: "user",
        parts: [{ text: newMessage }]
      });
    }

    // Configure tools
    const tools = [
      {
        functionDeclarations: [
          {
            name: "trackOrderAndShipping",
            description: "Track the status of an order and its shipping/tracking details using the Order ID (e.g., RYVO-ORD-1234).",
            parameters: {
              type: Type.OBJECT,
              properties: {
                orderId: { type: Type.STRING, description: "The order number or ID" }
              },
              required: ["orderId"]
            }
          },
          {
            name: "searchProducts",
            description: "Search for motorcycles, helmets, gears, or accessories in the RYVO store.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                queryText: { type: Type.STRING, description: "Search query or product name" }
              },
              required: ["queryText"]
            }
          },
          {
            name: "checkLoyaltyPointsAndCoupons",
            description: "Check the customer's loyalty points balance, wallet balance, and active discount coupons using their email.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                email: { type: Type.STRING, description: "The user's registered email address" }
              },
              required: ["email"]
            }
          }
        ]
      }
    ];

    // Load continuous learning approved FAQ
    let approvedKnowledgeStr = "";
    try {
      const approvedList = await getApprovedKnowledge();
      if (approvedList && approvedList.length > 0) {
        approvedKnowledgeStr = "\n\nLearned Knowledge Base (FAQ) approved by Admin:\n" + approvedList.map((item: any) => `Q: ${item.question}\nA: ${item.answer}`).join("\n---\n");
      }
    } catch (e) {
      console.warn("Could not fetch approved knowledge base items:", e);
    }

    // Load customer profile and last order context
    let customerProfileStr = "";
    if (conversation && conversation.clientEmail) {
      try {
        const db = getDbInstance();
        if (db) {
          const userDoc = await db.collection("users").doc(conversation.clientEmail.toLowerCase().trim()).get();
          let name = conversation.clientName || "Guest";
          let points = 0;
          let wallet = 0;
          if (userDoc.exists()) {
            const ud = userDoc.data();
            name = ud.name || name;
            points = ud.points || 0;
            wallet = ud.wallet_balance || 0;
          }
          
          // Fetch last order
          const ordersSnap = await db.collection("orders").get();
          const userOrders = ordersSnap.docs
            .map((d: any) => d.data())
            .filter((o: any) => o.user_email?.toLowerCase() === conversation.clientEmail.toLowerCase().trim());
          
          let lastOrderInfo = "No previous orders.";
          if (userOrders.length > 0) {
            userOrders.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            const lo = userOrders[0];
            lastOrderInfo = `Order ID: ${lo.id}, Date: ${lo.date}, Status: ${lo.status}, Total: ${lo.total} SAR, Tracking Carrier: ${lo.supplier_name || 'RYVO Express'}, Tracking Number: ${lo.tracking_number || 'Pending'}, Expected Delivery: 2-3 Days.`;
          }

          customerProfileStr = `
Customer Profile details (DO NOT ask the customer to enter these again, they are automatically known!):
- Name: ${name}
- Email: ${conversation.clientEmail}
- Loyalty Points: ${points}
- Wallet Balance: ${wallet} SAR
- Last Order Details: ${lastOrderInfo}
- Total Orders Count: ${userOrders.length}
- Device: ${conversation.device || 'Desktop'}
- OS: ${conversation.os || 'Windows'}
- Browser: ${conversation.browser || 'Chrome'}
- Country: ${conversation.country || 'SA'}
- Current Language Preferred: ${conversation.language || 'ar'}
`;
        }
      } catch (e) {
        console.warn("Could not fetch user profile details:", e);
      }
    }

    const dynamicInstructions = `
${SYSTEM_INSTRUCTIONS}

${customerProfileStr}

${approvedKnowledgeStr}

REMEMBER: If the user asks where their order is, or requests details about points, use the tools or direct context above to answer in a helpful, friendly, and structured manner (do not ask them for their email/name/order ID if they are already visible in the context above!). Always detect and reply in the user's language preferred or detected.
`;

    // Call Gemini with tools
    let response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: dynamicInstructions,
        tools: tools
      }
    });

    // Check for function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const { name, args } = call;
      let functionResult = "";

      console.log(`🤖 AI triggered function call: ${name}`, args);

      if (name === "trackOrderAndShipping") {
        functionResult = await trackOrderAndShipping((args as any).orderId);
      } else if (name === "searchProducts") {
        functionResult = await searchProducts((args as any).queryText);
      } else if (name === "checkLoyaltyPointsAndCoupons") {
        functionResult = await checkLoyaltyPointsAndCoupons((args as any).email);
      }

      // Add the function call and result back to contents and generate again
      contents.push(response.candidates?.[0]?.content as any || {
        role: "model",
        parts: [{ functionCall: { name, args } }]
      });

      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: name,
            response: { result: functionResult }
          }
        }]
      });

      // Call Gemini again to format answer
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: dynamicInstructions
        }
      });
    }

    return response.text || "I apologize, I am unable to formulate a response at the moment.";
  } catch (err: any) {
    console.error("Error generating Gemini response:", err);
    return "عذراً، حدث خطأ أثناء معالجة رد الذكاء الاصطناعي. هل تريد تحويلي إلى موظف دعم بشري؟ [TRANSFER_TO_AGENT]";
  }
}

// Generate Smart Summary (ai_summary) before transferring to agent
export async function generateSmartSummary(conversation: any): Promise<string> {
  const defaultSummary = `اسم العميل: ${conversation.clientName || 'زائر'}
رقم الطلب: غير محدد
نوع المشكلة: استفسار عام
محاولات الذكاء الاصطناعي: محاولة الرد على الاستفسارات تلقائياً
سبب التحويل: طلب التحدث مع الدعم الفني
الحالة: بانتظار موظف`;

  if (!ai) {
    return defaultSummary;
  }

  try {
    const messagesText = conversation.messages
      .map((m: any) => `${m.sender === 'user' ? 'العميل' : 'الذكاء الاصطناعي'}: ${m.text}`)
      .join("\n");

    const systemPrompt = `
You are a support supervisor. Summarize the chat log between the customer and our AI support assistant into a neat, professional summary for the human agent.
You MUST write the summary clearly in Arabic using this EXACT format:

اسم العميل: <Name>
رقم الطلب: <Order ID, or 'لا يوجد' if not mentioned>
نوع المشكلة: <Specific issue type>
محاولات الذكاء الاصطناعي: <Brief summary of what the AI tried or answered>
سبب التحويل: <Why the conversation is being transferred to a human agent>
الحالة: بانتظار موظف

Do NOT include any other text, labels, introduction, or markdown styling outside this exact format.
`;

    const userPrompt = `
Chat Log:
${messagesText}

Please generate the structured summary now. Keep it brief, factual, and strictly compliant.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt
      }
    });

    return response.text?.trim() || defaultSummary;
  } catch (err: any) {
    console.error("Error generating smart summary:", err);
    return defaultSummary;
  }
}
