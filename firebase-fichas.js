const timersSalvamentoJogador =
    new Map();


function copiarFichaJogador(
    ficha
){

    return JSON.parse(
        JSON.stringify(ficha)
    );

}


async function salvarFichaJogadorNoFirestore(
    ficha
){

    const usuario =
        auth.currentUser;


    if(
        !usuario
        ||
        window.papelUsuario !== "jogador"
        ||
        !ficha
    ){

        return false;

    }


    try{

        const dados =
            copiarFichaJogador(
                ficha
            );


        /*
         * Enquanto ainda não resolvemos
         * as fotos, elas não vão para
         * o Firestore.
         */
        delete dados.foto;


        /*
         * Jogador nunca possui acesso
         * aos dados secretos de Sorte.
         */
        delete dados.sorte;


        /*
         * Nem o JavaScript nem o usuário
         * escolhem estes dois valores.
         */
        dados.tipo =
            "jogador";


        dados.dono =
            usuario.uid;


        dados.atualizadoEm =
            firebase.firestore
                .FieldValue
                .serverTimestamp();


        await db
            .collection(
                "fichasJogadores"
            )
            .doc(
                String(ficha.id)
            )
            .set(
                dados,
                {
                    merge:true
                }
            );


        return true;


    }catch(erro){

        alert(
            "Não foi possível salvar a ficha.\n\n" +
            erro.message
        );


        return false;

    }

}


window.salvarFichaJogadorNoFirestore =
    salvarFichaJogadorNoFirestore;


/*
 * Salvamento automático com atraso.
 *
 * Continua evitando uma escrita por
 * tecla digitada.
 */
window.agendarSalvamentoFirestore =
function(ficha){

    if(
        window.papelUsuario !== "jogador"
        ||
        !window.jogadorUsandoFirestoreDireto
        ||
        !ficha
    ){

        return;

    }


    const copia =
        copiarFichaJogador(
            ficha
        );


    const id =
        String(copia.id);


    clearTimeout(
        timersSalvamentoJogador.get(
            id
        )
    );


    const timer =
        setTimeout(
            async () => {

                await salvarFichaJogadorNoFirestore(
                    copia
                );


                timersSalvamentoJogador.delete(
                    id
                );

            },
            1000
        );


    timersSalvamentoJogador.set(
        id,
        timer
    );

};


/*
 * CARREGAR AS FICHAS DO JOGADOR
 */
async function carregarFichasJogadorDoFirestore(){

    if(
        window.papelUsuario !== "jogador"
    ){
        return;
    }


    const usuario =
        auth.currentUser;


    if(!usuario){
        return;
    }


    try{

        const resultado =
            await db
                .collection(
                    "fichasJogadores"
                )
                .where(
                    "dono",
                    "==",
                    usuario.uid
                )
                .get();


        const fichas =
            [];


        resultado.forEach(
            documento => {

                const dados = {
                    ...documento.data()
                };


                /*
                 * ID oficial é o ID
                 * do documento.
                 */
                dados.id =
                    Number(
                        documento.id
                    )
                    ||
                    Number(
                        dados.id
                    )
                    ||
                    Date.now();


                dados.tipo =
                    "jogador";


                dados.dono =
                    usuario.uid;


                /*
                 * Mesmo que algum documento
                 * antigo estivesse errado,
                 * Sorte não entra na memória
                 * da conta de jogador.
                 */
                delete dados.sorte;

                delete dados.atualizadoEm;


                fichas.push(
                    normalizarFicha(
                        dados
                    )
                );

            }
        );

        fichas.sort(
            (a, b) => {

                const ordemA =
                    Number.isFinite(
                        Number(a.ordem)
                    )
                    ? Number(a.ordem)
                    : 999999;


                const ordemB =
                    Number.isFinite(
                        Number(b.ordem)
                    )
                    ? Number(b.ordem)
                    : 999999;


                if(
                    ordemA !== ordemB
                ){

                    return (
                        ordemA -
                        ordemB
                    );

                }


                return (
                    Number(a.id) -
                    Number(b.id)
                );

            }
        );
        
if(typeof window.carregarFotosDasFichas === "function"){
    await window.carregarFotosDasFichas(fichas);
}

        banco = {

            atual:
                fichas[0]?.id
                ?? null,

            fichas:
                fichas

        };


        /*
         * A partir daqui o localStorage
         * deixa de participar.
         */
        window.jogadorUsandoFirestoreDireto =
            true;


        window.jogadorAguardandoFirestore =
            false;


        /*
         * Usuário novo sem nenhuma ficha:
         * cria automaticamente a primeira.
         */
        if(
            banco.fichas.length === 0
        ){

            criarFichaNova();

        }


        carregarFichaAtual();

        atualizarBotaoExcluir();


    }catch(erro){

        window.jogadorUsandoFirestoreDireto =
            false;


        alert(
            "Não foi possível carregar suas fichas.\n\n" +
            erro.message
        );

    }

}
window.addEventListener("jogador-precisa-carregar-fichas", carregarFichasJogadorDoFirestore);
if(window.jogadorAguardandoFirestore && window.papelUsuario === "jogador"){
    carregarFichasJogadorDoFirestore();
}