const invoiceMembershipTemplate = `
doctype html
html
    head
        style(type='text/css').
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            .content {
                background: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 10px 10px;
            }
            .info-section {
                background: white;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                border-left: 4px solid #667eea;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            .info-row:last-child {
                border-bottom: none;
            }
            .label {
                font-weight: 600;
                color: #555;
            }
            .value {
                color: #333;
            }
            .status-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }
            .status-pending {
                background-color: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
            }
            .status-paid {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            .status-failed {
                background-color: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .cta-container {
                text-align: center;
                margin: 30px 0;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #666;
                font-size: 14px;
            }
            .courselit-branding {
                margin-top: 20px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 6px;
                text-align: center;
            }
            .courselit-branding a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
    body
        .header
            h1 #{emailTitle}
        
        .content
            p Hello #{userName},
            
            p #{emailMessage}
            
            .info-section
                h3(style="margin-top: 0; color: #667eea;") Course Information
                .info-row
                    span.label Course Name:
                    span.value #{courseTitle}
                .info-row
                    span.label Course Type:
                    span.value #{courseType}
                .info-row
                    span.label Creator:
                    span.value #{creatorName}
            
            .info-section
                h3(style="margin-top: 0; color: #667eea;") Membership Details
                .info-row
                    span.label Membership ID:
                    span.value #{membershipId}
                .info-row
                    span.label Status:
                    span.value
                        span.status-badge(class="status-#{membershipStatus}") #{membershipStatus}
                .info-row
                    span.label Role:
                    span.value #{membershipRole}
                .info-row
                    span.label Joined:
                    span.value #{membershipDate}
            
            if invoiceInfo
                .info-section
                    h3(style="margin-top: 0; color: #667eea;") Invoice Information
                    .info-row
                        span.label Invoice ID:
                        span.value #{invoiceId}
                    .info-row
                        span.label Amount:
                        span.value #{currencySymbol}#{amount}
                    .info-row
                        span.label Status:
                        span.value
                            span.status-badge(class="status-#{invoiceStatus}") #{invoiceStatus}
                    .info-row
                        span.label Payment Method:
                        span.value #{paymentProcessor}
                    .info-row
                        span.label Created:
                        span.value #{invoiceDate}
            
            .cta-container
                if eventType === "checkout.session.expired"
                    a.cta-button(href="#{loginLink}") Retry Payment
                else
                    a.cta-button(href="#{loginLink}") Access Your Course
            
            p(style="margin-top: 30px; color: #666;") If you have any questions, please don't hesitate to contact our support team.
            
            .footer
                p This email was sent to #{userEmail}
                p Sent on #{currentDate}
                
                if !hideCourseLitBranding
                    .courselit-branding
                        a(href="https://courselit.app" target="_blank") Powered by CourseLit
`;

export default invoiceMembershipTemplate;
