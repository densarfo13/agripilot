/**
 * resetPasswordTranslations.js — i18n overlay for the
 * /reset-password page.
 *
 * The ResetPassword.jsx component already supplies inline English
 * fallbacks via `resolve(t, key, fallback)`, so a missing locale
 * never crashes the page. This overlay provides translations for
 * every launch language so a French / Swahili / Hausa / Twi /
 * Hindi farmer who clicks the email link doesn't see English copy
 * leak through.
 *
 * Keys covered (mirrors the L map in ResetPassword.jsx):
 *   auth.resetPassword.title / subtitle
 *   auth.resetPassword.newPassword / confirmPassword
 *   auth.resetPassword.newPasswordHint / confirmPasswordHint
 *   auth.resetPassword.submit / submitting / backToLogin
 *   auth.resetPassword.errNewPwRequired / errConfirmRequired
 *   auth.resetPassword.errMinLen / errMismatch / errGeneric
 *   auth.resetPassword.successTitle / successSubtitle / successCta
 *   auth.resetPassword.expiredTitle / expiredSubtitle / expiredCta
 *   auth.resetPassword.verifyingTitle / verifyingSubtitle
 *
 * Strict-rule audit
 *   * Empty-slot fill via mergeManyOverlays — translator-authored
 *     values still win
 *   * Generic copy: never names the user, never says "your email
 *     <foo@bar>" — anti-enumeration is a backend property and the
 *     UI must not undo it by interpolating the email
 *   * Error copy is uniform: every dead-link reason resolves to
 *     the same `expiredTitle` / `expiredSubtitle` so the UI mirrors
 *     the server's opacity
 */

const MIN_PW = 8;

export const RESET_PASSWORD_TRANSLATIONS = Object.freeze({
  en: {
    'auth.resetPassword.title':            'Reset your password',
    'auth.resetPassword.subtitle':
      'Enter your new password below to regain access to your Farroway account.',
    'auth.resetPassword.newPassword':      'New password',
    'auth.resetPassword.confirmPassword':  'Confirm password',
    'auth.resetPassword.newPasswordHint':  `At least ${MIN_PW} characters`,
    'auth.resetPassword.confirmPasswordHint': 'Re-enter your new password',
    'auth.resetPassword.submit':           'Reset Password',
    'auth.resetPassword.submitting':       'Resetting\u2026',
    'auth.resetPassword.backToLogin':      'Back to login',
    'auth.resetPassword.errNewPwRequired': 'New password is required',
    'auth.resetPassword.errConfirmRequired': 'Confirm password is required',
    'auth.resetPassword.errMinLen':        `Password must be at least ${MIN_PW} characters`,
    'auth.resetPassword.errMismatch':      'Passwords do not match',
    'auth.resetPassword.errGeneric':
      'Unable to reset password right now. Please try again.',
    'auth.resetPassword.successTitle':     'Your password has been reset',
    'auth.resetPassword.successSubtitle':  'You can now sign in.',
    'auth.resetPassword.successCta':       'Back to sign in',
    'auth.resetPassword.expiredTitle':     'Reset link invalid or expired',
    'auth.resetPassword.expiredSubtitle':
      'Request a new reset email and try again.',
    'auth.resetPassword.expiredCta':       'Request new reset link',
    'auth.resetPassword.verifyingTitle':   'Checking your reset link\u2026',
    'auth.resetPassword.verifyingSubtitle':
      'One moment while we make sure this link is still valid.',
  },

  fr: {
    'auth.resetPassword.title':            'R\u00E9initialiser votre mot de passe',
    'auth.resetPassword.subtitle':
      'Saisissez votre nouveau mot de passe pour retrouver l\u2019acc\u00E8s \u00E0 votre compte Farroway.',
    'auth.resetPassword.newPassword':      'Nouveau mot de passe',
    'auth.resetPassword.confirmPassword':  'Confirmer le mot de passe',
    'auth.resetPassword.newPasswordHint':  `Au moins ${MIN_PW} caract\u00E8res`,
    'auth.resetPassword.confirmPasswordHint': 'Saisissez \u00E0 nouveau le mot de passe',
    'auth.resetPassword.submit':           'R\u00E9initialiser',
    'auth.resetPassword.submitting':       'R\u00E9initialisation\u2026',
    'auth.resetPassword.backToLogin':      'Retour \u00E0 la connexion',
    'auth.resetPassword.errNewPwRequired': 'Le nouveau mot de passe est requis',
    'auth.resetPassword.errConfirmRequired': 'La confirmation est requise',
    'auth.resetPassword.errMinLen':        `Le mot de passe doit contenir au moins ${MIN_PW} caract\u00E8res`,
    'auth.resetPassword.errMismatch':      'Les mots de passe ne correspondent pas',
    'auth.resetPassword.errGeneric':
      'Impossible de r\u00E9initialiser pour le moment. R\u00E9essayez.',
    'auth.resetPassword.successTitle':     'Votre mot de passe a \u00E9t\u00E9 r\u00E9initialis\u00E9',
    'auth.resetPassword.successSubtitle':  'Vous pouvez maintenant vous connecter.',
    'auth.resetPassword.successCta':       'Retour \u00E0 la connexion',
    'auth.resetPassword.expiredTitle':     'Lien invalide ou expir\u00E9',
    'auth.resetPassword.expiredSubtitle':
      'Demandez un nouvel e-mail de r\u00E9initialisation et r\u00E9essayez.',
    'auth.resetPassword.expiredCta':       'Demander un nouveau lien',
    'auth.resetPassword.verifyingTitle':   'V\u00E9rification du lien\u2026',
    'auth.resetPassword.verifyingSubtitle':
      'Un instant, nous v\u00E9rifions que ce lien est toujours valide.',
  },

  sw: {
    'auth.resetPassword.title':            'Weka upya nenosiri lako',
    'auth.resetPassword.subtitle':
      'Andika nenosiri lako jipya ili upate tena akaunti yako ya Farroway.',
    'auth.resetPassword.newPassword':      'Nenosiri jipya',
    'auth.resetPassword.confirmPassword':  'Thibitisha nenosiri',
    'auth.resetPassword.newPasswordHint':  `Angalau herufi ${MIN_PW}`,
    'auth.resetPassword.confirmPasswordHint': 'Andika tena nenosiri lako',
    'auth.resetPassword.submit':           'Weka Nenosiri',
    'auth.resetPassword.submitting':       'Inaweka\u2026',
    'auth.resetPassword.backToLogin':      'Rudi kuingia',
    'auth.resetPassword.errNewPwRequired': 'Nenosiri jipya linahitajika',
    'auth.resetPassword.errConfirmRequired': 'Uthibitisho wa nenosiri unahitajika',
    'auth.resetPassword.errMinLen':        `Nenosiri lazima liwe na herufi ${MIN_PW} au zaidi`,
    'auth.resetPassword.errMismatch':      'Manenosiri hayalingani',
    'auth.resetPassword.errGeneric':
      'Imeshindikana kuweka nenosiri sasa. Jaribu tena.',
    'auth.resetPassword.successTitle':     'Nenosiri lako limewekwa upya',
    'auth.resetPassword.successSubtitle':  'Sasa unaweza kuingia.',
    'auth.resetPassword.successCta':       'Rudi kuingia',
    'auth.resetPassword.expiredTitle':     'Kiungo si halali au kimekwisha',
    'auth.resetPassword.expiredSubtitle':
      'Omba barua pepe mpya ya kuweka upya na ujaribu tena.',
    'auth.resetPassword.expiredCta':       'Omba kiungo kipya',
    'auth.resetPassword.verifyingTitle':   'Tunakagua kiungo chako\u2026',
    'auth.resetPassword.verifyingSubtitle':
      'Subiri kidogo tunahakikisha kiungo bado ni halali.',
  },

  ha: {
    'auth.resetPassword.title':            'Saita kalmar wucewar ka kuma',
    'auth.resetPassword.subtitle':
      'Shigar da sabuwar kalmar wucewa don dawo wa asusunka na Farroway.',
    'auth.resetPassword.newPassword':      'Sabuwar kalmar wucewa',
    'auth.resetPassword.confirmPassword':  'Tabbatar da kalmar wucewa',
    'auth.resetPassword.newPasswordHint':  `Akalla haruffa ${MIN_PW}`,
    'auth.resetPassword.confirmPasswordHint': 'Sake shigar da kalmar wucewa',
    'auth.resetPassword.submit':           'Saita Kalmar Wucewa',
    'auth.resetPassword.submitting':       'Ana saitawa\u2026',
    'auth.resetPassword.backToLogin':      'Komawa zuwa shiga',
    'auth.resetPassword.errNewPwRequired': 'Sabuwar kalmar wucewa ana buk\u0101tarta',
    'auth.resetPassword.errConfirmRequired': 'Tabbatarwa ana buk\u0101tarta',
    'auth.resetPassword.errMinLen':        `Kalmar wucewa dole ta kasance da haruffa ${MIN_PW} ko fiye`,
    'auth.resetPassword.errMismatch':      'Kalmomin wucewa ba sa daidai',
    'auth.resetPassword.errGeneric':
      'Ba a iya saitawa yanzu ba. A sake gwadawa.',
    'auth.resetPassword.successTitle':     'An saita kalmar wucewar ka kuma',
    'auth.resetPassword.successSubtitle':  'Yanzu zaka iya shiga.',
    'auth.resetPassword.successCta':       'Komawa zuwa shiga',
    'auth.resetPassword.expiredTitle':     'Hanyar haɗi ba ta inganci ba ko ta ƙare',
    'auth.resetPassword.expiredSubtitle':
      'A nemi sabuwar imel na saitawa kuma a sake gwadawa.',
    'auth.resetPassword.expiredCta':       'Nemi sabuwar hanyar haɗi',
    'auth.resetPassword.verifyingTitle':   'Ana duba hanyar haɗin ka\u2026',
    'auth.resetPassword.verifyingSubtitle':
      'Da\u017Eai kawai muna tabbatarwa cewa hanyar haɗi har yanzu tana aiki.',
  },

  tw: {
    'auth.resetPassword.title':            'San yɛ wo kɔdeɛ no foforɔ',
    'auth.resetPassword.subtitle':
      'Ky\u025Br\u025Bw wo kɔdeɛ foforɔ na fa kɔ wo Farroway akawunt no mu bio.',
    'auth.resetPassword.newPassword':      'Kɔdeɛ foforɔ',
    'auth.resetPassword.confirmPassword':  'Ky\u025Br\u025Bw kɔdeɛ no bio',
    'auth.resetPassword.newPasswordHint':  `Nkyer\u025Bwde\u025B ${MIN_PW} firi nyim`,
    'auth.resetPassword.confirmPasswordHint': 'San ky\u025Br\u025Bw wo kɔdeɛ',
    'auth.resetPassword.submit':           'San Yɛ Kɔdeɛ',
    'auth.resetPassword.submitting':       'R\u025Bs\u0254\u2026',
    'auth.resetPassword.backToLogin':      'San kɔ shiga',
    'auth.resetPassword.errNewPwRequired': 'Kɔdeɛ foforɔ ho hia',
    'auth.resetPassword.errConfirmRequired': 'Kɔdeɛ ho nhyehyɛeɛ ho hia',
    'auth.resetPassword.errMinLen':        `Kɔdeɛ no nkyer\u025Bwde\u025B no\u025By\u025B ${MIN_PW} firi nyim`,
    'auth.resetPassword.errMismatch':      'Kɔdeɛ no nhyia',
    'auth.resetPassword.errGeneric':
      'Y\u025Bantumi anyɛ no foforɔ s\u025Bes\u025Bei. S\u025Br\u025B s\u0254 mu.',
    'auth.resetPassword.successTitle':     'Wo kɔdeɛ no, wɔayɛ no foforɔ',
    'auth.resetPassword.successSubtitle':  'Afei wob\u025Btumi ahyɛn mu.',
    'auth.resetPassword.successCta':       'San kɔ shiga',
    'auth.resetPassword.expiredTitle':     'Hanyar haɗi nyɛ papa anaa\u02BCab\u025B',
    'auth.resetPassword.expiredSubtitle':
      'Bisa imel foforɔ na s\u0254 mu bio.',
    'auth.resetPassword.expiredCta':       'Bisa hanyar foforɔ',
    'auth.resetPassword.verifyingTitle':   'Y\u025Br\u025Bhw\u025B wo hanya no\u2026',
    'auth.resetPassword.verifyingSubtitle':
      'Twɛn kakra. Y\u025Br\u025Bhw\u025B s\u025B hanya no da so y\u025B papa.',
  },

  hi: {
    'auth.resetPassword.title':            'अपना पासवर्ड रीसेट करें',
    'auth.resetPassword.subtitle':
      'अपना नया पासवर्ड दर्ज करें ताकि आप Farroway खाते में पुनः प्रवेश कर सकें।',
    'auth.resetPassword.newPassword':      'नया पासवर्ड',
    'auth.resetPassword.confirmPassword':  'पासवर्ड की पुष्टि करें',
    'auth.resetPassword.newPasswordHint':  `कम से कम ${MIN_PW} अक्षर`,
    'auth.resetPassword.confirmPasswordHint': 'अपना नया पासवर्ड फिर से डालें',
    'auth.resetPassword.submit':           'पासवर्ड रीसेट करें',
    'auth.resetPassword.submitting':       'रीसेट हो रहा है…',
    'auth.resetPassword.backToLogin':      'लॉगिन पर वापस',
    'auth.resetPassword.errNewPwRequired': 'नया पासवर्ड आवश्यक है',
    'auth.resetPassword.errConfirmRequired': 'पुष्टि पासवर्ड आवश्यक है',
    'auth.resetPassword.errMinLen':        `पासवर्ड में कम से कम ${MIN_PW} अक्षर होने चाहिए`,
    'auth.resetPassword.errMismatch':      'पासवर्ड मेल नहीं खाते',
    'auth.resetPassword.errGeneric':
      'अभी पासवर्ड रीसेट नहीं हो सका। कृपया पुनः प्रयास करें।',
    'auth.resetPassword.successTitle':     'आपका पासवर्ड रीसेट हो गया है',
    'auth.resetPassword.successSubtitle':  'अब आप साइन इन कर सकते हैं।',
    'auth.resetPassword.successCta':       'लॉगिन पर वापस',
    'auth.resetPassword.expiredTitle':     'रीसेट लिंक अमान्य या समाप्त',
    'auth.resetPassword.expiredSubtitle':
      'नया रीसेट ईमेल अनुरोध करें और पुनः प्रयास करें।',
    'auth.resetPassword.expiredCta':       'नया रीसेट लिंक माँगें',
    'auth.resetPassword.verifyingTitle':   'आपका रीसेट लिंक जाँच रहे हैं…',
    'auth.resetPassword.verifyingSubtitle':
      'एक पल — हम पुष्टि कर रहे हैं कि यह लिंक अभी भी मान्य है।',
  },
});

export default RESET_PASSWORD_TRANSLATIONS;
