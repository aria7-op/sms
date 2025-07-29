import OpenAI from 'openai';
import natural from 'natural';
import nlp from 'compromise';
import logger from '../config/logger.js';

// Initialize AI clients conditionally
let openai = null;
let huggingface = null;
let cohere = null;

// OpenAI client
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    logger.info('OpenAI client initialized');
} else {
    logger.warn('OPENAI_API_KEY not found. OpenAI features disabled.');
}

// Hugging Face client (free tier available)
async function initHuggingFace() {
if (process.env.HUGGINGFACE_API_KEY) {
    try {
        const { HfApi } = await import('@huggingface/inference');
        huggingface = new HfApi({ accessToken: process.env.HUGGINGFACE_API_KEY });
        logger.info('Hugging Face client initialized');
    } catch (error) {
        logger.warn('Hugging Face client not available. Install with: npm install @huggingface/inference');
    }
} else {
    logger.warn('HUGGINGFACE_API_KEY not found. Hugging Face features disabled.');
}
}
initHuggingFace();

// Cohere client (free tier available)
async function initCohere() {
if (process.env.COHERE_API_KEY) {
    try {
        const { CohereClient } = await import('cohere-ai');
        cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
        logger.info('Cohere client initialized');
    } catch (error) {
        logger.warn('Cohere client not available. Install with: npm install cohere-ai');
    }
} else {
    logger.warn('COHERE_API_KEY not found. Cohere features disabled.');
}
}
initCohere();

class AIService {
    constructor() {
        this.tokenizer = new natural.WordTokenizer();
        this.sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    }

    /**
     * Process message with AI analysis
     */
    async processMessageAI(message, analysisType = 'SENTIMENT') {
        try {
            const startTime = Date.now();
            let result = {};

            switch (analysisType) {
                case 'SENTIMENT':
                    result = await this.analyzeSentiment(message.content);
                    break;
                case 'MODERATION':
                    result = await this.moderateContent(message.content);
                    break;
                case 'TRANSLATION':
                    result = await this.translateMessage(message.content, message.language);
                    break;
                case 'SUMMARIZATION':
                    result = await this.summarizeMessage(message.content);
                    break;
                case 'SUGGESTION':
                    result = await this.generateSuggestions(message.content, message.conversationId);
                    break;
                default:
                    result = await this.analyzeSentiment(message.content);
            }

            const processingTime = Date.now() - startTime;

            return {
                ...result,
                model: 'gpt-4',
                version: '1.0',
                processingTime,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error(`Error in AI processing: ${error.message}`);
            throw error;
        }
    }

    /**
     * Analyze message sentiment
     */
    async analyzeSentiment(content) {
        try {
            // Use natural language processing for sentiment analysis
            const tokens = this.tokenizer.tokenize(content);
            const sentimentScore = this.sentiment.getSentiment(tokens);

            // Use OpenAI for more accurate sentiment analysis if available
            if (openai) {
                try {
                    const completion = await openai.chat.completions.create({
                        model: "gpt-4",
                        messages: [
                            {
                                role: "system",
                                content: "Analyze the sentiment of the following message. Return a JSON object with 'sentiment' (positive, negative, neutral), 'confidence' (0-1), and 'emotions' (array of detected emotions)."
                            },
                            {
                                role: "user",
                                content: content
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 150
                    });

                    const aiAnalysis = JSON.parse(completion.choices[0].message.content);

                    return {
                        sentiment: aiAnalysis.sentiment,
                        confidence: aiAnalysis.confidence,
                        emotions: aiAnalysis.emotions,
                        score: sentimentScore,
                        type: 'SENTIMENT'
                    };
                } catch (openaiError) {
                    logger.error(`OpenAI sentiment analysis error: ${openaiError.message}`);
                }
            }

            // Fallback to local sentiment analysis
            const sentiment = sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral';
            const confidence = Math.min(Math.abs(sentimentScore) / 10, 0.8);

            return {
                sentiment,
                confidence,
                emotions: [],
                score: sentimentScore,
                type: 'SENTIMENT'
            };

        } catch (error) {
            logger.error(`Error in sentiment analysis: ${error.message}`);
            return {
                sentiment: 'neutral',
                confidence: 0.5,
                emotions: [],
                score: 0,
                type: 'SENTIMENT'
            };
        }
    }

    /**
     * Moderate content for inappropriate content
     */
    async moderateContent(content) {
        try {
            const completion = await openai.moderations.create({
                input: content
            });

            const moderation = completion.results[0];
            const categories = moderation.categories;
            const categoryScores = moderation.category_scores;

            const flaggedCategories = Object.keys(categories).filter(category => categories[category]);

            return {
                isFlagged: moderation.flagged,
                flaggedCategories,
                categoryScores,
                type: 'MODERATION'
            };

        } catch (error) {
            logger.error(`Error in content moderation: ${error.message}`);
            return {
                isFlagged: false,
                flaggedCategories: [],
                categoryScores: {},
                type: 'MODERATION'
            };
        }
    }

    /**
     * Translate message
     */
    async translateMessage(content, targetLanguage = 'en') {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `Translate the following message to ${targetLanguage}. Maintain the original tone and context.`
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            return {
                originalText: content,
                translatedText: completion.choices[0].message.content,
                targetLanguage,
                type: 'TRANSLATION'
            };

        } catch (error) {
            logger.error(`Error in translation: ${error.message}`);
            return {
                originalText: content,
                translatedText: content,
                targetLanguage,
                type: 'TRANSLATION'
            };
        }
    }

    /**
     * Summarize message
     */
    async summarizeMessage(content) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Summarize the following message in a concise way while maintaining the key points."
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            });

            return {
                originalText: content,
                summary: completion.choices[0].message.content,
                type: 'SUMMARIZATION'
            };

        } catch (error) {
            logger.error(`Error in summarization: ${error.message}`);
            return {
                originalText: content,
                summary: content.substring(0, 100) + '...',
                type: 'SUMMARIZATION'
            };
        }
    }

    /**
     * Generate smart reply suggestions
     */
    async generateSuggestions(content, conversationId, context = {}) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Generate 3-5 smart reply suggestions for the following message. Make them natural, contextual, and helpful. Return as JSON array."
                    },
                    {
                        role: "user",
                        content: `Message: "${content}"\nContext: ${JSON.stringify(context)}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            });

            const suggestions = JSON.parse(completion.choices[0].message.content);

            return {
                suggestions,
                context,
                type: 'SUGGESTION'
            };

        } catch (error) {
            logger.error(`Error generating suggestions: ${error.message}`);
            return {
                suggestions: [
                    "Thank you for your message.",
                    "I understand.",
                    "Let me get back to you on that."
                ],
                context,
                type: 'SUGGESTION'
            };
        }
    }

    /**
     * Extract entities from message
     */
    async extractEntities(content) {
        try {
            const doc = nlp(content);
            
            const entities = {
                people: doc.people().out('array'),
                places: doc.places().out('array'),
                organizations: doc.organizations().out('array'),
                dates: doc.dates().out('array'),
                numbers: doc.numbers().out('array'),
                emails: doc.emails().out('array'),
                urls: doc.urls().out('array')
            };

            return {
                entities,
                type: 'ENTITY_EXTRACTION'
            };

        } catch (error) {
            logger.error(`Error extracting entities: ${error.message}`);
            return {
                entities: {},
                type: 'ENTITY_EXTRACTION'
            };
        }
    }

    /**
     * Detect message intent
     */
    async detectIntent(content) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Analyze the intent of the following message. Return a JSON object with 'intent' (question, statement, request, greeting, etc.) and 'confidence' (0-1)."
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                temperature: 0.3,
                max_tokens: 100
            });

            const intent = JSON.parse(completion.choices[0].message.content);

            return {
                intent: intent.intent,
                confidence: intent.confidence,
                type: 'INTENT_DETECTION'
            };

        } catch (error) {
            logger.error(`Error detecting intent: ${error.message}`);
            return {
                intent: 'statement',
                confidence: 0.5,
                type: 'INTENT_DETECTION'
            };
        }
    }

    /**
     * Generate conversation insights
     */
    async generateConversationInsights(messages, conversationId) {
        try {
            const messageContent = messages.map(m => m.content).join('\n');
            
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Analyze the following conversation and provide insights. Return a JSON object with 'topics', 'sentiment_trend', 'key_points', and 'suggestions'."
                    },
                    {
                        role: "user",
                        content: messageContent
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            const insights = JSON.parse(completion.choices[0].message.content);

            return {
                conversationId,
                insights,
                type: 'CONVERSATION_INSIGHTS'
            };

        } catch (error) {
            logger.error(`Error generating conversation insights: ${error.message}`);
            return {
                conversationId,
                insights: {
                    topics: [],
                    sentiment_trend: 'neutral',
                    key_points: [],
                    suggestions: []
                },
                type: 'CONVERSATION_INSIGHTS'
            };
        }
    }

    /**
     * Auto-complete message
     */
    async autoCompleteMessage(partialMessage, context = {}) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Complete the following partial message in a natural way. Consider the context provided."
                    },
                    {
                        role: "user",
                        content: `Partial message: "${partialMessage}"\nContext: ${JSON.stringify(context)}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 100
            });

            return {
                partialMessage,
                completedMessage: completion.choices[0].message.content,
                type: 'AUTO_COMPLETE'
            };

        } catch (error) {
            logger.error(`Error in auto-complete: ${error.message}`);
            return {
                partialMessage,
                completedMessage: partialMessage,
                type: 'AUTO_COMPLETE'
            };
        }
    }

    /**
     * Generate message templates
     */
    async generateMessageTemplates(category, context = {}) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `Generate 5 message templates for the category: ${category}. Make them professional and versatile. Return as JSON array.`
                    },
                    {
                        role: "user",
                        content: `Context: ${JSON.stringify(context)}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 400
            });

            const templates = JSON.parse(completion.choices[0].message.content);

            return {
                category,
                templates,
                type: 'MESSAGE_TEMPLATES'
            };

        } catch (error) {
            logger.error(`Error generating templates: ${error.message}`);
            return {
                category,
                templates: [
                    "Thank you for your message.",
                    "I appreciate your feedback.",
                    "Let me know if you need anything else."
                ],
                type: 'MESSAGE_TEMPLATES'
            };
        }
    }
}

export default new AIService(); 