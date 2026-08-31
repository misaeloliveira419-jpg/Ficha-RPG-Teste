const telaLogin =
    document.getElementById(
        "tela-login"
    );


const areaSite =
    document.querySelector(
        ".area-site"
    );


/*
 * LOGIN
 */

const areaLogin =
    document.getElementById(
        "area-login"
    );

const campoEmail =
    document.getElementById(
        "login-email"
    );

const campoSenha =
    document.getElementById(
        "login-senha"
    );

const botaoMostrarLoginSenha =
    document.getElementById(
        "mostrar-login-senha"
    );


if(
    botaoMostrarLoginSenha
    &&
    campoSenha
){

    botaoMostrarLoginSenha
        .addEventListener(
            "click",
            () => {

                const senhaEstaVisivel =
                    campoSenha.type ===
                    "text";


                if(senhaEstaVisivel){

                    campoSenha.type =
                        "password";

                    botaoMostrarLoginSenha
                        .textContent =
                        "👁";

                    botaoMostrarLoginSenha
                        .setAttribute(
                            "aria-label",
                            "Mostrar senha"
                        );

                    botaoMostrarLoginSenha
                        .title =
                        "Mostrar senha";

                }else{

                    campoSenha.type =
                        "text";

                    botaoMostrarLoginSenha
                        .textContent =
                        "🙈";

                    botaoMostrarLoginSenha
                        .setAttribute(
                            "aria-label",
                            "Ocultar senha"
                        );

                    botaoMostrarLoginSenha
                        .title =
                        "Ocultar senha";

                }

            }
        );

}

const botaoLogin =
    document.getElementById(
        "botao-login"
    );

const erroLogin =
    document.getElementById(
        "erro-login"
    );

const abrirCadastro =
    document.getElementById(
        "abrir-cadastro"
    );


/*
 * CADASTRO
 */

const areaCadastro =
    document.getElementById(
        "area-cadastro"
    );

const cadastroNome =
    document.getElementById(
        "cadastro-nome"
    );

const cadastroEmail =
    document.getElementById(
        "cadastro-email"
    );

const cadastroSenha =
    document.getElementById(
        "cadastro-senha"
    );

const cadastroConfirmarSenha =
    document.getElementById(
        "cadastro-confirmar-senha"
    );

const botaoCadastro =
    document.getElementById(
        "botao-cadastro"
    );

const erroCadastro =
    document.getElementById(
        "erro-cadastro"
    );

const voltarLogin =
    document.getElementById(
        "voltar-login"
    );


/*
 * Evita que onAuthStateChanged tente
 * carregar o usuário antes de o cadastro
 * terminar de criar usuarios/{UID}.
 */
let cadastroEmAndamento =
    false;


/*
 * CONTROLE DAS TELAS
 */

function mostrarLogin(){

    areaCadastro.style.display =
        "none";

    areaLogin.style.display =
        "flex";


    erroLogin.textContent =
        "";

    erroCadastro.textContent =
        "";

}


function mostrarCadastro(){

    areaLogin.style.display =
        "none";

    areaCadastro.style.display =
        "flex";


    erroLogin.textContent =
        "";

    erroCadastro.textContent =
        "";

}


/*
 * DADOS DO USUÁRIO
 */

async function obterDadosUsuario(
    usuario
){

    const documento =
        await db
            .collection(
                "usuarios"
            )
            .doc(
                usuario.uid
            )
            .get();


    if(!documento.exists){

        throw new Error(
            "Usuário sem cadastro no Firestore."
        );

    }


    return documento.data();

}


/*
 * FINALIZA UM LOGIN
 *
 * Tanto login normal quanto cadastro
 * passam por esta função.
 */

async function processarUsuarioAutenticado(
    usuario
){

    const dados =
        await obterDadosUsuario(
            usuario
        );


    if(
        dados.papel !== "mestre"
        &&
        dados.papel !== "jogador"
    ){

        throw new Error(
            "Tipo de usuário inválido."
        );

    }


    window.usuarioAtual =
        usuario;


    window.papelUsuario =
        dados.papel;


    /*
     * Esconde login e libera o site.
     */
    telaLogin.style.display =
        "none";


    areaSite.style.visibility =
        "visible";


    areaSite.style.pointerEvents =
        "";


    /*
     * Avisa os outros arquivos.
     */
    window.dispatchEvent(
        new CustomEvent(
            "usuario-autenticado",
            {
                detail:{
                    uid:
                        usuario.uid,

                    papel:
                        dados.papel
                }
            }
        )
    );

}


/*
 * LOGIN
 */

async function entrar(){

    const email =
        campoEmail.value.trim();


    const senha =
        campoSenha.value;


    erroLogin.textContent =
        "";


    if(
        !email ||
        !senha
    ){

        erroLogin.textContent =
            "Digite o e-mail e a senha.";

        return;

    }


    botaoLogin.disabled =
        true;


    botaoLogin.textContent =
        "Entrando...";


    try{

        await auth
            .signInWithEmailAndPassword(
                email,
                senha
            );


    }catch(erro){

        console.error(
            erro
        );


        erroLogin.textContent =
            "E-mail ou senha incorretos.";

    }finally{

        botaoLogin.disabled =
            false;


        botaoLogin.textContent =
            "Entrar";

    }

}


/*
 * CRIAR CONTA
 */

async function criarConta(){

    const nome =
        cadastroNome.value.trim();


    const email =
        cadastroEmail.value.trim();


    const senha =
        cadastroSenha.value;


    const confirmarSenha =
        cadastroConfirmarSenha.value;


    erroCadastro.textContent =
        "";


    if(
        !nome ||
        !email ||
        !senha ||
        !confirmarSenha
    ){

        erroCadastro.textContent =
            "Preencha todos os campos.";

        return;

    }


    if(nome.length < 2){

        erroCadastro.textContent =
            "Digite um nome válido.";

        return;

    }


    if(senha.length < 6){

        erroCadastro.textContent =
            "A senha precisa ter pelo menos 6 caracteres.";

        return;

    }


    if(
        senha !==
        confirmarSenha
    ){

        erroCadastro.textContent =
            "As senhas não são iguais.";

        return;

    }


    botaoCadastro.disabled =
        true;


    botaoCadastro.textContent =
        "Criando conta...";


    cadastroEmAndamento =
        true;


    let credencial =
        null;


    try{

        /*
         * Primeiro cria a conta no
         * Firebase Authentication.
         *
         * Isso também autentica
         * automaticamente o usuário.
         */
        credencial =
            await auth
                .createUserWithEmailAndPassword(
                    email,
                    senha
                );


        const usuario =
            credencial.user;


        /*
         * Em seguida cria o perfil
         * correspondente no Firestore.
         *
         * O papel NÃO vem de nenhum
         * input do usuário.
         */
        await db
            .collection(
                "usuarios"
            )
            .doc(
                usuario.uid
            )
            .set({

                nome:
                    nome,

                papel:
                    "jogador",

                criadoEm:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });


        cadastroEmAndamento =
            false;


        /*
         * Agora usuarios/{UID}
         * já existe e podemos entrar
         * normalmente no site.
         */
        await processarUsuarioAutenticado(
            usuario
        );


    }catch(erro){

        console.error(
            erro
        );


        cadastroEmAndamento =
            false;


        /*
         * Se o Authentication foi criado
         * mas o perfil no Firestore falhou,
         * tentamos desfazer a conta.
         *
         * Assim evitamos um usuário
         * incompleto preso no sistema.
         */
        if(
            credencial &&
            credencial.user
        ){

            try{

                await credencial
                    .user
                    .delete();


            }catch(erroExcluir){

                console.error(
                    erroExcluir
                );

            }

        }


        switch(erro.code){

            case "auth/email-already-in-use":

                erroCadastro.textContent =
                    "Este e-mail já possui uma conta.";

                break;


            case "auth/invalid-email":

                erroCadastro.textContent =
                    "Digite um e-mail válido.";

                break;


            case "auth/weak-password":

                erroCadastro.textContent =
                    "Escolha uma senha mais forte.";

                break;


            case "auth/too-many-requests":

                erroCadastro.textContent =
                    "Muitas tentativas. Tente novamente mais tarde.";

                break;


            default:

                erroCadastro.textContent =
                    "Não foi possível criar a conta.";

                break;

        }

    }finally{

        botaoCadastro.disabled =
            false;


        botaoCadastro.textContent =
            "Criar conta";

    }

}


/*
 * BOTÕES
 */

botaoLogin.addEventListener(
    "click",
    entrar
);


campoSenha.addEventListener(
    "keydown",
    evento => {

        if(
            evento.key ===
            "Enter"
        ){

            entrar();

        }

    }
);


abrirCadastro.addEventListener(
    "click",
    mostrarCadastro
);


voltarLogin.addEventListener(
    "click",
    mostrarLogin
);


botaoCadastro.addEventListener(
    "click",
    criarConta
);


cadastroConfirmarSenha
    .addEventListener(
        "keydown",
        evento => {

            if(
                evento.key ===
                "Enter"
            ){

                criarConta();

            }

        }
    );


/*
 * SESSÃO FIREBASE
 */

auth.onAuthStateChanged(
    async usuario => {

        /*
         * createUserWithEmailAndPassword
         * também dispara este listener.
         *
         * Durante cadastro, a própria
         * função criarConta() cuida dele.
         */
        if(cadastroEmAndamento){
            return;
        }


        if(!usuario){

            window.usuarioAtual =
                null;


            window.papelUsuario =
                null;


            telaLogin.style.display =
                "flex";


            areaSite.style.visibility =
                "hidden";


            areaSite.style.pointerEvents =
                "none";


            mostrarLogin();


            return;

        }


        try{

            await processarUsuarioAutenticado(
                usuario
            );


        }catch(erro){

            console.error(
                erro
            );


            erroLogin.textContent =
                "Sua conta não possui acesso ao sistema.";


            await auth.signOut();

        }

    }
);


/*
 * SAIR
 */

const botaoSair =
    document.getElementById(
        "sair-conta"
    );


if(botaoSair){

    botaoSair.addEventListener(
        "click",
        async () => {

            await auth.signOut();

        }
    );

}