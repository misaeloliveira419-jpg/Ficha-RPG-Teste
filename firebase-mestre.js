let jogadoresCadastrados = [];


async function carregarJogadoresCadastrados(){
    if(window.papelUsuario !== "mestre"){
        return;
    }
    const seletor = document.getElementById("dono-ficha");
    if(!seletor){
        return;
    }
    try{
        const resultado = await db.collection("usuarios").where("papel", "==", "jogador").get();
        jogadoresCadastrados = [];
        resultado.forEach(documento => {
            const dados = documento.data();
            jogadoresCadastrados.push({
                uid: documento.id,
                nome: dados.nome || "Jogador"
            });
        });
        jogadoresCadastrados.sort((a, b) => a.nome.localeCompare(b.nome,"pt-BR"));
        atualizarOpcoesDono();
    }
    catch(erro){
        alert("Erro ao carregar jogadores: " + erro.message
        );
    }
}

function atualizarOpcoesDono(){

    const seletor =
        document.getElementById(
            "dono-ficha"
        );


    if(!seletor){
        return;
    }


    const valorAtual =
        seletor.value;


    seletor.innerHTML =
        `
        <option value="">
            Não atribuída
        </option>
        `;


    jogadoresCadastrados
        .forEach(
            jogador => {

                const opcao =
                    document.createElement(
                        "option"
                    );


                opcao.value =
                    jogador.uid;


                opcao.textContent =
                    jogador.nome;


                seletor.appendChild(
                    opcao
                );

            }
        );


    if(
        [
            ...seletor.options
        ].some(
            opcao =>
                opcao.value ===
                valorAtual
        )
    ){

        seletor.value =
            valorAtual;

    }

}

window.atualizarInterfaceDonoFicha =
function(){

    const controle =
        document.getElementById(
            "controle-dono-ficha"
        );


    const seletor =
        document.getElementById(
            "dono-ficha"
        );


    if(
        !controle ||
        !seletor
    ){
        return;
    }


    const ficha =
        typeof fichaAtual === "function"
        ? fichaAtual()
        : null;


    const deveMostrar =
        window.papelUsuario === "mestre"
        &&
        ficha
        &&
        ficha.tipo === "jogador";


    controle.style.display =
        deveMostrar
        ? "block"
        : "none";


    if(!deveMostrar){
        return;
    }


    seletor.value =
        ficha.dono || "";

};

const seletorDonoFicha =
    document.getElementById(
        "dono-ficha"
    );


if(seletorDonoFicha){
    seletorDonoFicha.addEventListener("change", async () => {
        if(window.papelUsuario !== "mestre"){
            return;
        }
        const ficha = fichaAtual();
        if(!ficha || ficha.tipo !== "jogador"){
            return;
        }
        ficha.dono = seletorDonoFicha.value || null;
        ficha.modificadoEm = Date.now();
        salvarBanco();
        if(window.mestreUsandoFirestoreDireto){
            try{
                await salvarFichaMestreNoFirestore(ficha);
            }
            catch(erro){
                alert("Erro ao atribuir o dono da ficha:\n\n" + erro.message);
            }
        }
    });
}

window.addEventListener(
    "usuario-autenticado",
    () => {

        if(
            window.papelUsuario ===
            "mestre"
        ){

            carregarJogadoresCadastrados();

        }

    }
);


if(
    window.papelUsuario === "mestre"
){

    carregarJogadoresCadastrados();

}

function copiarFichaParaBanco(ficha){

    return JSON.parse(
        JSON.stringify(ficha)
    );

}


function obterColecaoTipoFicha(tipo){

    switch(tipo){

        case "jogador":
            return "fichasJogadores";

        case "npc":
            return "fichasNPC";

        case "criatura":
            return "fichasCriaturas";

        default:
            throw new Error(
                "Tipo de ficha inválido: " +
                tipo
            );

    }

}

async function salvarFichaMestreNoFirestore(
    ficha
){

    if(
        window.papelUsuario !== "mestre"
    ){

        throw new Error(
            "Apenas o Mestre pode usar esta função."
        );

    }


    ficha =
        normalizarFicha(
            ficha
        );


    const id =
        String(
            ficha.id
        );


    const tipo =
        ficha.tipo;


    const colecaoDestino =
        obterColecaoTipoFicha(
            tipo
        );


    const dados =
        copiarFichaParaBanco(
            ficha
        );


    /*
     * A foto continua preservada
     * no localStorage.
     *
     * Ainda NÃO será enviada ao
     * Firestore.
     */
    delete dados.foto;


    /*
     * Sorte nunca entra no documento
     * público da ficha.
     */
    let sorte = null;


    if(tipo === "jogador"){

        sorte =
            Math.max(
                0,
                Math.floor(
                    Number(
                        dados.sorte
                    ) || 0
                )
            );


        delete dados.sorte;


        dados.dono =
            typeof ficha.dono === "string"
            &&
            ficha.dono.trim()

            ? ficha.dono.trim()
            : null;

    }else{

        delete dados.sorte;

        delete dados.dono;

    }


    dados.tipo =
        tipo;


    dados.atualizadoEm =
        firebase.firestore
            .FieldValue
            .serverTimestamp();


    const referenciaJogador =
        db
            .collection(
                "fichasJogadores"
            )
            .doc(id);


    const referenciaNPC =
        db
            .collection(
                "fichasNPC"
            )
            .doc(id);


    const referenciaCriatura =
        db
            .collection(
                "fichasCriaturas"
            )
            .doc(id);


    const referenciaSegredo =
        db
            .collection(
                "segredosFichasJogadores"
            )
            .doc(id);


    const batch =
        db.batch();
    
    if(tipo !== "jogador"){

        batch.delete(
            referenciaJogador
        );

    }


    if(tipo !== "npc"){

        batch.delete(
            referenciaNPC
        );

    }


    if(tipo !== "criatura"){

        batch.delete(
            referenciaCriatura
        );

    }


    /*
     * Salva na coleção correta.
     */
    const referenciaDestino =
        db
            .collection(
                colecaoDestino
            )
            .doc(id);


    batch.set(
        referenciaDestino,
        dados,
        {
            merge:true
        }
    );


    /*
     * Sorte é um segredo exclusivo
     * das fichas de jogador.
     */
    if(tipo === "jogador"){

        batch.set(
            referenciaSegredo,
            {

                fichaId:id,

                sorte:sorte,

                desbloqueada:false,

                atualizadoEm:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            },
            {
                merge:true
            }
        );

    }else{

        batch.delete(
            referenciaSegredo
        );

    }


    /*
     * Remove também o documento do
     * formato antigo usado durante
     * nossos primeiros testes:
     *
     * UID_ID
     */
    if(
        tipo === "jogador" &&
        ficha.dono
    ){

        const idAntigo =
            ficha.dono +
            "_" +
            id;


        if(idAntigo !== id){

            batch.delete(
                db
                    .collection(
                        "fichasJogadores"
                    )
                    .doc(idAntigo)
            );

        }

    }


    await batch.commit();

}

window.salvarFichaMestreNoFirestore =
    salvarFichaMestreNoFirestore;


const timersSalvamentoMestre =
    new Map();


window.agendarSalvamentoMestreFirestore =
function(ficha){

    if(
        window.papelUsuario !== "mestre"
        ||
        !window.mestreUsandoFirestoreDireto
        ||
        !ficha
    ){
        return;
    }


    /*
     * Snapshot para evitar salvar outra
     * ficha caso o Mestre troque de tela
     * antes do timer terminar.
     */
    const copia =
        JSON.parse(
            JSON.stringify(ficha)
        );


    const chave =
        String(copia.id);


    clearTimeout(
        timersSalvamentoMestre.get(
            chave
        )
    );


    const timer =
        setTimeout(
            async () => {

                try{

                    await salvarFichaMestreNoFirestore(
                        copia
                    );

                }catch(erro){

                    alert(
                        "Erro ao salvar a ficha " +
                        "no Firestore:\n\n" +
                        erro.message
                    );

                }


                timersSalvamentoMestre
                    .delete(chave);

            },
            1000
        );


    timersSalvamentoMestre.set(
        chave,
        timer
    );

};

let migracaoEmAndamento = false;


async function migrarTodasAsFichas(){

    if(
        window.papelUsuario !== "mestre"
    ){
        return;
    }


    if(migracaoEmAndamento){
        return;
    }


    if(
        !banco ||
        !Array.isArray(
            banco.fichas
        )
    ){

        alert(
            "Não foi possível encontrar as fichas locais."
        );

        return;

    }


    if(
        banco.fichas.length === 0
    ){

        alert(
            "Não existem fichas para migrar."
        );

        return;

    }


    const jogadores =
        banco.fichas.filter(
            ficha =>
                normalizarTipoFicha(
                    ficha.tipo
                ) === "jogador"
        );


    const npcs =
        banco.fichas.filter(
            ficha =>
                normalizarTipoFicha(
                    ficha.tipo
                ) === "npc"
        );


    const criaturas =
        banco.fichas.filter(
            ficha =>
                normalizarTipoFicha(
                    ficha.tipo
                ) === "criatura"
        );


    const semDono =
        jogadores.filter(
            ficha =>
                !ficha.dono
        );


    let mensagem =
        "Serão migradas " +
        banco.fichas.length +
        " fichas:\n\n" +

        "Jogadores: " +
        jogadores.length +
        "\n" +

        "NPCs: " +
        npcs.length +
        "\n" +

        "Criaturas: " +
        criaturas.length;


    if(semDono.length > 0){

        mensagem +=
            "\n\n" +
            semDono.length +
            " ficha(s) de jogador ainda " +
            "não possuem dono.\n" +
            "Elas serão salvas normalmente, " +
            "mas nenhum jogador poderá vê-las ainda.";

    }


    mensagem +=
        "\n\n" +
        "O localStorage NÃO será apagado nesta etapa.";


    const confirmar =
        confirm(
            mensagem
        );


    if(!confirmar){
        return;
    }


    migracaoEmAndamento =
        true;


    const botao =
        document.getElementById(
            "migrar-fichas-firestore"
        );


    if(botao){

        botao.disabled =
            true;

        botao.textContent =
            "Migrando...";

    }


    let migradas =
        0;


    const erros =
        [];


    try{

        /*
         * Salva a ficha que está
         * atualmente aberta antes
         * de começar.
         */
        salvarFichaAtual();


        for(
            const ficha
            of banco.fichas
        ){

            try{

                await salvarFichaMestreNoFirestore(
                    ficha
                );


                migradas++;


            }catch(erro){

                erros.push({

                    ficha:
                        ficha.personagem
                        ||
                        ficha.jogador
                        ||
                        String(ficha.id),

                    erro:
                        erro.message

                });

            }

        }


        if(erros.length === 0){

            alert(
                "Migração concluída!\n\n" +
                migradas +
                " ficha(s) foram salvas no Firestore.\n\n" +
                "O localStorage continua intacto."
            );

        }else{

            const nomesErros =
                erros
                    .slice(0, 8)
                    .map(
                        item =>
                            "• " +
                            item.ficha +
                            ": " +
                            item.erro
                    )
                    .join("\n");


            alert(
                "Migração parcialmente concluída.\n\n" +
                "Migradas: " +
                migradas +
                "\n" +

                "Erros: " +
                erros.length +
                "\n\n" +

                nomesErros
            );

        }


    }finally{

        migracaoEmAndamento =
            false;


        if(botao){

            botao.disabled =
                false;

            botao.textContent =
                "Migrar fichas para o banco";

        }

    }

}

const botaoMigracao =
    document.getElementById(
        "migrar-fichas-firestore"
    );


if(botaoMigracao){

    botaoMigracao.addEventListener(
        "click",
        migrarTodasAsFichas
    );

}


function atualizarBotaoMigracao(){

    if(!botaoMigracao){
        return;
    }


    botaoMigracao.style.display =
        window.papelUsuario === "mestre"
        ? "block"
        : "none";

}


window.addEventListener(
    "usuario-autenticado",
    atualizarBotaoMigracao
);


if(window.papelUsuario){

    atualizarBotaoMigracao();

}

async function salvarOrdemFichasMestre(){

    if(
        window.papelUsuario !== "mestre"
        ||
        !window.mestreUsandoFirestoreDireto
    ){
        return;
    }


    if(
        !Array.isArray(
            banco.fichas
        )
    ){
        return;
    }


    const batch =
        db.batch();


    banco.fichas.forEach(
        (ficha, indice) => {

            ficha.ordem =
                indice;


            const colecao =
                obterColecaoTipoFicha(
                    ficha.tipo
                );


            const referencia =
                db
                    .collection(
                        colecao
                    )
                    .doc(
                        String(ficha.id)
                    );


            batch.set(
                referencia,
                {
                    ordem:indice
                },
                {
                    merge:true
                }
            );

        }
    );


    await batch.commit();

}


window.salvarOrdemFichasMestre =
    salvarOrdemFichasMestre;

async function carregarFichasMestreDoFirestore(){

    if(
        window.papelUsuario !== "mestre"
    ){
        return;
    }


    const usuario =
        auth.currentUser;


    if(!usuario){
        return;
    }


    try{
        const [resultadoJogadores, resultadoNPCs, resultadoCriaturas, resultadoSegredos] =
        await Promise.all([db.collection("fichasJogadores").get(), db.collection("fichasNPC").get(),

            db
                .collection(
                    "fichasCriaturas"
                )
                .get(),

            db
                .collection(
                    "segredosFichasJogadores"
                )
                .get()

        ]);


        const segredos =
            new Map();


        resultadoSegredos.forEach(
            documento => {

                segredos.set(
                    documento.id,
                    documento.data()
                );

            }
        );


        const fichasCarregadas =
            [];


        function adicionarDocumentos(
            resultado,
            tipo
        ){

            resultado.forEach(
                documento => {

                    const dados = {
                        ...documento.data()
                    };


                    /*
                     * O ID oficial passa a ser
                     * o ID do documento.
                     */
                    dados.id =
                        Number(documento.id)
                        ||
                        Number(dados.id)
                        ||
                        Date.now();


                    dados.tipo =
                        tipo;


                    /*
                     * Sorte só é reunida aqui
                     * porque esta é a interface
                     * privada do Mestre.
                     */
                    if(
                        tipo === "jogador"
                    ){

                        const segredo =
                            segredos.get(
                                documento.id
                            );


                        dados.sorte =
                            Number(
                                segredo?.sorte
                            ) || 0;

                    }else{

                        delete dados.sorte;
                        delete dados.dono;

                    }


                    delete dados.atualizadoEm;


                    fichasCarregadas.push(
                        normalizarFicha(
                            dados
                        )
                    );

                }
            );

        }


        adicionarDocumentos(
            resultadoJogadores,
            "jogador"
        );


        adicionarDocumentos(
            resultadoNPCs,
            "npc"
        );


        adicionarDocumentos(
            resultadoCriaturas,
            "criatura"
        );

        fichasCarregadas.sort(
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


                if(ordemA !== ordemB){

                    return ordemA - ordemB;

                }


                return (
                    Number(a.id) -
                    Number(b.id)
                );

            }
        );


        fichasCarregadas.forEach(
            (ficha, indice) => {

                ficha.ordem =
                    indice;

            }
        );

if(typeof window.carregarFotosDasFichas === "function"){
    await window.carregarFotosDasFichas(fichasCarregadas);
}
        
        banco = {

            atual:
                fichasCarregadas[0]?.id
                ?? null,

            fichas:
                fichasCarregadas

        };
        
        window.mestreUsandoFirestoreDireto =
            true;


        window.mestreAguardandoFirestore =
            false;


        if(
            banco.fichas.length === 0
        ){

            criarFichaNova();

        }


        carregarFichaAtual();

        atualizarBotaoExcluir();


        /*
         * Garante que documentos migrados
         * anteriormente recebam uma ordem.
         */
        await salvarOrdemFichasMestre();


    }catch(erro){

        window.mestreUsandoFirestoreDireto =
            false;


        alert(
            "Não foi possível carregar as fichas " +
            "do Mestre pelo Firestore.\n\n" +
            erro.message
        );

    }

}

window.addEventListener(
    "mestre-precisa-carregar-fichas",
    carregarFichasMestreDoFirestore
);


/*
 * firebase-mestre.js é carregado depois
 * de script.js.
 *
 * Portanto o evento pode ter acontecido
 * antes de chegarmos aqui.
 */
if(
    window.mestreAguardandoFirestore
    &&
    window.papelUsuario === "mestre"
){

    carregarFichasMestreDoFirestore();

}

window.apagarFichaMestreFirestore = async function(ficha){
    if(window.papelUsuario !== "mestre" ||!ficha){
        return false;
    }
    const id =
        String(
            ficha.id
        );


    try{

        const batch =
            db.batch();

        batch.delete(
            db
                .collection(
                    "fichasJogadores"
                )
                .doc(id)
        );


        batch.delete(
            db
                .collection(
                    "fichasNPC"
                )
                .doc(id)
        );


        batch.delete(
            db
                .collection(
                    "fichasCriaturas"
                )
                .doc(id)
        );


        batch.delete(
            db
                .collection(
                    "segredosFichasJogadores"
                )
                .doc(id)
        );
        
        batch.delete(db.collection("fotosFichas").doc(id));
        await batch.commit();
        return true;


    }catch(erro){

        alert(
            "Não foi possível apagar a ficha:\n\n" +
            erro.message
        );


        return false;

    }

};