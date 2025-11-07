import nodemailer from 'nodemailer';

// Configuração do transporter SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

// Função para enviar email
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: 'Sistema de Agendamento de Espaços',
        address: process.env.SMTP_EMAIL
      },
      to,
      subject,
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
};

// Templates de email
export const emailTemplates = {
  // Código de recuperação de senha
  passwordResetCode: (data) => ({
    subject: `Código para Redefinição de Senha`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Redefinição de Senha</h2>
        <p>Olá <strong>${data.name || 'usuário'}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Utilize o código abaixo:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #111827;">${data.code}</div>
          <div style="margin-top: 8px; color: #6b7280; font-size: 14px;">Esse código expira em 5 minutos.</div>
        </div>
        <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">Se você não solicitou essa alteração, pode ignorar este email.</p>
      </div>
    `,
    text: `Código para Redefinição de Senha\n\nOlá ${data.name || 'usuário'},\n\nSeu código é: ${data.code}\nEsse código expira em 5 minutos.\nSe você não solicitou, ignore este email.`
  }),
  // Notificação de nova reserva para professor
  newReservationForProfessor: (data) => ({
    subject: `Nova Reserva Pendente - ${data.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nova Reserva Pendente</h2>
        <p>Olá <strong>${data.professor_name}</strong>,</p>
        <p>Você recebeu uma nova solicitação de reserva que precisa de sua aprovação:</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Detalhes da Reserva</h3>
          <p><strong>Evento:</strong> ${data.title}</p>
          <p><strong>Aluno:</strong> ${data.student_name}</p>
          <p><strong>Sala:</strong> ${data.room_name}</p>
          <p><strong>Data:</strong> ${new Date(data.start_time).toLocaleDateString('pt-BR')}</p>
          <p><strong>Horário:</strong> ${new Date(data.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.end_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
          <p><strong>Projeto:</strong> ${data.project_name}</p>
          ${data.description ? `<p><strong>Descrição:</strong> ${data.description}</p>` : ''}
        </div>
        
        <p>Acesse o sistema para aprovar ou rejeitar esta reserva.</p>
        <p style="color: #6b7280; font-size: 14px;">Este é um email automático do Sistema de Agendamento de Espaços.</p>
      </div>
    `,
    text: `Nova Reserva Pendente - ${data.title}\n\nOlá ${data.professor_name},\n\nVocê recebeu uma nova solicitação de reserva que precisa de sua aprovação:\n\nEvento: ${data.title}\nAluno: ${data.student_name}\nSala: ${data.room_name}\nData: ${new Date(data.start_time).toLocaleDateString('pt-BR')}\nHorário: ${new Date(data.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.end_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}\nProjeto: ${data.project_name}\n${data.description ? `Descrição: ${data.description}\n` : ''}\nAcesse o sistema para aprovar ou rejeitar esta reserva.`
  }),

  // Notificação de nova reserva para admin
  newReservationForAdmin: (data) => ({
    subject: `Nova Reserva Pendente - ${data.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Nova Reserva Pendente - Aprovação Administrativa</h2>
        <p>Olá Administrador,</p>
        <p>Uma nova reserva foi aprovada pelo professor e precisa de sua aprovação final:</p>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="color: #374151; margin-top: 0;">Detalhes da Reserva</h3>
          <p><strong>Evento:</strong> ${data.title}</p>
          <p><strong>Aluno:</strong> ${data.student_name}</p>
          <p><strong>Sala:</strong> ${data.room_name}</p>
          <p><strong>Data:</strong> ${new Date(data.start_time).toLocaleDateString('pt-BR')}</p>
          <p><strong>Horário:</strong> ${new Date(data.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.end_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
          <p><strong>Projeto:</strong> ${data.project_name}</p>
          <p><strong>Aprovado por:</strong> ${data.professor_name}</p>
          ${data.description ? `<p><strong>Descrição:</strong> ${data.description}</p>` : ''}
        </div>
        
        <p>Acesse o sistema para dar a aprovação final ou rejeitar esta reserva.</p>
        <p style="color: #6b7280; font-size: 14px;">Este é um email automático do Sistema de Agendamento de Espaços.</p>
      </div>
    `,
    text: `Nova Reserva Pendente - Aprovação Administrativa\n\nOlá Administrador,\n\nUma nova reserva foi aprovada pelo professor e precisa de sua aprovação final:\n\nEvento: ${data.title}\nAluno: ${data.student_name}\nSala: ${data.room_name}\nData: ${new Date(data.start_time).toLocaleDateString('pt-BR')}\nHorário: ${new Date(data.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.end_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}\nProjeto: ${data.project_name}\nAprovado por: ${data.professor_name}\n${data.description ? `Descrição: ${data.description}\n` : ''}\nAcesse o sistema para dar a aprovação final ou rejeitar esta reserva.`
  }),

  // Notificação de status da reserva para aluno
  reservationStatusUpdate: (data) => {
    // Verificar se foi aprovada (approved ou professor_approved)
    const isApproved = data.status === 'approved' || data.status === 'professor_approved';
    const isProfessorApproved = data.status === 'professor_approved';
    const statusText = isProfessorApproved ? 'Aprovada pelo Professor' : (isApproved ? 'Aprovada' : 'Rejeitada');
    const statusLabel = isProfessorApproved ? 'APROVADA PELO PROFESSOR' : (isApproved ? 'APROVADA' : 'REJEITADA');
    
    return {
      subject: isProfessorApproved ? `Reserva Aprovada pelo Professor - ${data.title}` : `Status da Reserva Atualizado - ${data.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${isApproved ? '#059669' : '#dc2626'};">
            Reserva ${statusText} - ${data.title}
          </h2>
          <p>Olá <strong>${data.student_name}</strong>,</p>
          <p>Sua solicitação de reserva foi <strong>${isProfessorApproved ? 'aprovada pelo professor' : (isApproved ? 'aprovada' : 'rejeitada')}</strong>:</p>
          
          <div style="background-color: ${isApproved ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isApproved ? '#059669' : '#dc2626'};">
            <h3 style="color: #374151; margin-top: 0;">Detalhes da Reserva</h3>
            <p><strong>Evento:</strong> ${data.title}</p>
            <p><strong>Sala:</strong> ${data.room_name}</p>
            <p><strong>Data:</strong> ${new Date(data.start_time).toLocaleDateString('pt-BR')}</p>
            <p><strong>Horário:</strong> ${new Date(data.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.end_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
            <p><strong>Status:</strong> <span style="color: ${isApproved ? '#059669' : '#dc2626'}; font-weight: bold;">${statusLabel}</span></p>
            ${data.rejection_reason ? `<p><strong>Motivo da rejeição:</strong> ${data.rejection_reason}</p>` : ''}
          </div>
          
          ${isProfessorApproved ? 
            '<p style="color: #2563eb; font-weight: bold;">✅ Sua reserva foi aprovada pelo professor e enviada para aprovação final do administrador. Você será notificado quando houver uma resposta final.</p>' : 
            (isApproved ? 
              '<p style="color: #059669; font-weight: bold;">✅ Sua reserva foi confirmada! Você pode usar o espaço no horário agendado.</p>' : 
              '<p style="color: #dc2626;">❌ Sua reserva foi rejeitada. Entre em contato com a administração se tiver dúvidas.</p>'
            )
          }
          <p style="color: #6b7280; font-size: 14px;">Este é um email automático do Sistema de Agendamento de Espaços.</p>
        </div>
      `,
      text: `${isProfessorApproved ? 'Reserva Aprovada pelo Professor' : 'Status da Reserva Atualizado'} - ${data.title}\n\nOlá ${data.student_name},\n\nSua solicitação de reserva foi ${isProfessorApproved ? 'aprovada pelo professor' : (isApproved ? 'aprovada' : 'rejeitada')}:\n\nEvento: ${data.title}\nSala: ${data.room_name}\nData: ${new Date(data.start_time).toLocaleDateString('pt-BR')}\nHorário: ${new Date(data.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.end_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}\nStatus: ${statusLabel}\n${data.rejection_reason ? `Motivo da rejeição: ${data.rejection_reason}\n` : ''}\n${isProfessorApproved ? 'Sua reserva foi aprovada pelo professor e enviada para aprovação final do administrador. Você será notificado quando houver uma resposta final.' : (isApproved ? 'Sua reserva foi confirmada! Você pode usar o espaço no horário agendado.' : 'Sua reserva foi rejeitada. Entre em contato com a administração se tiver dúvidas.')}`
    };
  },

  // Notificação de nova solicitação de projeto para professor
  newProjectRequest: (data) => ({
    subject: `Nova Solicitação de Projeto - ${data.project_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Nova Solicitação de Projeto</h2>
        <p>Olá <strong>${data.professor_name}</strong>,</p>
        <p>Você recebeu uma nova solicitação de entrada em seu projeto:</p>
        
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <h3 style="color: #374151; margin-top: 0;">Detalhes da Solicitação</h3>
          <p><strong>Projeto:</strong> ${data.project_name}</p>
          <p><strong>Tipo:</strong> ${data.project_type}</p>
          <p><strong>Aluno:</strong> ${data.student_name}</p>
          <p><strong>Email:</strong> ${data.student_email}</p>
          <p><strong>Matrícula:</strong> ${data.student_matricula}</p>
          ${data.message ? `<p><strong>Mensagem do aluno:</strong> ${data.message}</p>` : ''}
        </div>
        
        <p>Acesse o sistema para aprovar ou rejeitar esta solicitação.</p>
        <p style="color: #6b7280; font-size: 14px;">Este é um email automático do Sistema de Agendamento de Espaços.</p>
      </div>
    `,
    text: `Nova Solicitação de Projeto - ${data.project_name}\n\nOlá ${data.professor_name},\n\nVocê recebeu uma nova solicitação de entrada em seu projeto:\n\nProjeto: ${data.project_name}\nTipo: ${data.project_type}\nAluno: ${data.student_name}\nEmail: ${data.student_email}\nMatrícula: ${data.student_matricula}\n${data.message ? `Mensagem do aluno: ${data.message}\n` : ''}\nAcesse o sistema para aprovar ou rejeitar esta solicitação.`
  }),

  // Notificação de status da solicitação de projeto para aluno
  projectRequestStatusUpdate: (data) => ({
    subject: `Solicitação de Projeto ${data.status === 'approved' ? 'Aprovada' : 'Rejeitada'} - ${data.project_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${data.status === 'approved' ? '#059669' : '#dc2626'};">
          Solicitação ${data.status === 'approved' ? 'Aprovada' : 'Rejeitada'} - ${data.project_name}
        </h2>
        <p>Olá <strong>${data.student_name}</strong>,</p>
        <p>Sua solicitação de entrada no projeto foi <strong>${data.status === 'approved' ? 'aprovada' : 'rejeitada'}</strong>:</p>
        
        <div style="background-color: ${data.status === 'approved' ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${data.status === 'approved' ? '#059669' : '#dc2626'};">
          <h3 style="color: #374151; margin-top: 0;">Detalhes do Projeto</h3>
          <p><strong>Projeto:</strong> ${data.project_name}</p>
          <p><strong>Tipo:</strong> ${data.project_type}</p>
          <p><strong>Professor:</strong> ${data.professor_name}</p>
          <p><strong>Status:</strong> <span style="color: ${data.status === 'approved' ? '#059669' : '#dc2626'}; font-weight: bold;">${data.status === 'approved' ? 'APROVADA' : 'REJEITADA'}</span></p>
        </div>
        
        ${data.status === 'approved' ? 
          '<p style="color: #059669; font-weight: bold;">✅ Parabéns! Você foi aceito no projeto e já pode fazer reservas de espaços.</p>' : 
          '<p style="color: #dc2626;">❌ Sua solicitação foi rejeitada. Entre em contato com o professor se tiver dúvidas.</p>'
        }
        <p style="color: #6b7280; font-size: 14px;">Este é um email automático do Sistema de Agendamento de Espaços.</p>
      </div>
    `,
    text: `Solicitação ${data.status === 'approved' ? 'Aprovada' : 'Rejeitada'} - ${data.project_name}\n\nOlá ${data.student_name},\n\nSua solicitação de entrada no projeto foi ${data.status === 'approved' ? 'aprovada' : 'rejeitada'}:\n\nProjeto: ${data.project_name}\nTipo: ${data.project_type}\nProfessor: ${data.professor_name}\nStatus: ${data.status === 'approved' ? 'APROVADA' : 'REJEITADA'}\n\n${data.status === 'approved' ? 'Parabéns! Você foi aceito no projeto e já pode fazer reservas de espaços.' : 'Sua solicitação foi rejeitada. Entre em contato com o professor se tiver dúvidas.'}`
  })
};

// Funções específicas para cada tipo de notificação
export const sendNewReservationNotification = async (reservationData, professorEmail) => {
  const template = emailTemplates.newReservationForProfessor(reservationData);
  return await sendEmail({
    to: professorEmail,
    ...template
  });
};

export const sendNewReservationForAdminNotification = async (reservationData, adminEmail) => {
  const template = emailTemplates.newReservationForAdmin(reservationData);
  return await sendEmail({
    to: adminEmail,
    ...template
  });
};

export const sendReservationStatusUpdate = async (reservationData, studentEmail) => {
  const template = emailTemplates.reservationStatusUpdate(reservationData);
  return await sendEmail({
    to: studentEmail,
    ...template
  });
};

export const sendNewProjectRequestNotification = async (requestData, professorEmail) => {
  const template = emailTemplates.newProjectRequest(requestData);
  return await sendEmail({
    to: professorEmail,
    ...template
  });
};

export const sendProjectRequestStatusUpdate = async (requestData, studentEmail) => {
  const template = emailTemplates.projectRequestStatusUpdate(requestData);
  return await sendEmail({
    to: studentEmail,
    ...template
  });
};
